-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','manager');
CREATE TYPE public.lead_status AS ENUM ('new','in_work','kp_sent','paid','lost');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- EMPLOYEES
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text UNIQUE,
  name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'manager',
  salary numeric NOT NULL DEFAULT 0,
  bonus_rate numeric NOT NULL DEFAULT 5,
  coef_min numeric NOT NULL DEFAULT 1.2,
  coef_target numeric NOT NULL DEFAULT 1.5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE POLICY "employees readable by staff" ON public.employees FOR SELECT TO authenticated
  USING (public.is_admin() OR id = public.current_employee_id());
CREATE POLICY "employees managed by admin" ON public.employees FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- LEADS
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_date date,
  name text NOT NULL DEFAULT 'Без имени',
  phone text,
  telegram text,
  income text,
  request text,
  status public.lead_status NOT NULL DEFAULT 'new',
  raw_status text,
  tariff text,
  amount numeric,
  net numeric,
  payment_method text,
  payment_date date,
  comment text,
  next_action text,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads read" ON public.leads FOR SELECT TO authenticated
  USING (public.is_admin() OR manager_id = public.current_employee_id());
CREATE POLICY "leads insert" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR manager_id = public.current_employee_id());
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated
  USING (public.is_admin() OR manager_id = public.current_employee_id())
  WITH CHECK (public.is_admin() OR manager_id = public.current_employee_id());
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated
  USING (public.is_admin() OR manager_id = public.current_employee_id());

-- PAYMENTS
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no integer,
  client_name text NOT NULL,
  contact text,
  tariff text,
  revenue numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  receivable numeric NOT NULL DEFAULT 0,
  payment_method text,
  payment_date date NOT NULL DEFAULT current_date,
  schedule text,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments read" ON public.payments FOR SELECT TO authenticated
  USING (public.is_admin() OR manager_id = public.current_employee_id());
CREATE POLICY "payments insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR manager_id = public.current_employee_id());
CREATE POLICY "payments update" ON public.payments FOR UPDATE TO authenticated
  USING (public.is_admin() OR manager_id = public.current_employee_id())
  WITH CHECK (public.is_admin() OR manager_id = public.current_employee_id());
CREATE POLICY "payments delete" ON public.payments FOR DELETE TO authenticated
  USING (public.is_admin());

-- PLANS
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period date NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  plan_min numeric NOT NULL DEFAULT 0,
  plan_target numeric NOT NULL DEFAULT 0,
  plan_max numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plans_period_employee_idx ON public.plans (period, COALESCE(employee_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans read" ON public.plans FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());
CREATE POLICY "plans admin write" ON public.plans FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- LINK auth user to employee record on first sign-in
CREATE OR REPLACE FUNCTION public.link_current_user()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  emp public.employees%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO emp FROM public.employees WHERE user_id = uid;
  IF NOT FOUND THEN
    SELECT * INTO emp FROM public.employees WHERE lower(email) = mail AND user_id IS NULL LIMIT 1;
    IF FOUND THEN
      UPDATE public.employees SET user_id = uid WHERE id = emp.id;
    ELSE
      INSERT INTO public.employees (user_id, email, name, role)
      VALUES (uid, mail, split_part(mail, '@', 1), 'manager')
      RETURNING * INTO emp;
    END IF;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, emp.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN emp.id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.link_current_user() TO authenticated;

-- keep payments in sync when a lead is marked paid
CREATE OR REPLACE FUNCTION public.sync_payment_from_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    IF NOT EXISTS (SELECT 1 FROM public.payments WHERE lead_id = NEW.id) THEN
      INSERT INTO public.payments (client_name, contact, tariff, revenue, net_profit, payment_method, payment_date, manager_id, lead_id)
      VALUES (NEW.name, coalesce(NEW.telegram, NEW.phone), NEW.tariff, coalesce(NEW.amount,0), coalesce(NEW.net,0),
              NEW.payment_method, coalesce(NEW.payment_date, current_date), NEW.manager_id, NEW.id);
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER leads_sync_payment BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_from_lead();