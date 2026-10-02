-- Normalized CRM schema.
-- This migration is intentionally additive: legacy leads/payment columns remain
-- available during the verification period.

DO $$ BEGIN
  CREATE TYPE public.deal_status AS ENUM (
    'new', 'in_work', 'offer_sent', 'awaiting_payment', 'paid', 'lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.activity_type AS ENUM ('call', 'message', 'meeting', 'task', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL DEFAULT 'Без имени',
  phone text,
  telegram text,
  income_band text,
  legacy_lead_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  list_price numeric(14,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_list_price_nonnegative CHECK (list_price IS NULL OR list_price >= 0)
);

CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  status public.deal_status NOT NULL DEFAULT 'new',
  lead_date date,
  source text,
  request text,
  agreed_amount numeric(14,2),
  expected_net numeric(14,2),
  payment_terms text,
  legacy_status text,
  lost_reason text,
  closed_at timestamptz,
  legacy_lead_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deals_agreed_amount_nonnegative CHECK (agreed_amount IS NULL OR agreed_amount >= 0),
  CONSTRAINT deals_expected_net_nonnegative CHECK (expected_net IS NULL OR expected_net >= 0)
);

CREATE TABLE IF NOT EXISTS public.deal_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_status public.deal_status,
  to_status public.deal_status NOT NULL,
  changed_by_user_id uuid,
  comment text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  type public.activity_type NOT NULL DEFAULT 'task',
  subject text NOT NULL,
  note text,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period date NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  plan_min numeric(14,2) NOT NULL DEFAULT 0,
  plan_target numeric(14,2) NOT NULL DEFAULT 0,
  plan_max numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_plans_period_month_start CHECK (period = date_trunc('month', period)::date),
  CONSTRAINT sales_plans_values_ordered CHECK (
    plan_min >= 0 AND plan_min <= plan_target AND plan_target <= plan_max
  )
);

CREATE TABLE IF NOT EXISTS public.compensation_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  valid_from date NOT NULL,
  valid_to date,
  salary numeric(14,2) NOT NULL DEFAULT 0,
  bonus_rate numeric(7,4) NOT NULL DEFAULT 0,
  coef_min numeric(7,4) NOT NULL DEFAULT 1,
  coef_target numeric(7,4) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compensation_dates_valid CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT compensation_values_valid CHECK (
    salary >= 0 AND bonus_rate >= 0 AND coef_min >= 0 AND coef_target >= 0
  )
);

-- One imported customer per legacy lead is deliberate. Automatic deduplication by
-- a name or an incomplete contact could merge different people.
INSERT INTO public.customers (
  full_name, phone, telegram, income_band, legacy_lead_id, created_at, updated_at
)
SELECT
  l.name, l.phone, l.telegram, l.income, l.id, l.created_at, l.updated_at
FROM public.leads l
ON CONFLICT (legacy_lead_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  telegram = EXCLUDED.telegram,
  income_band = EXCLUDED.income_band,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (code, name, list_price)
SELECT
  'legacy-' || substr(md5(lower(trim(l.tariff))), 1, 16),
  min(trim(l.tariff)),
  max(l.amount) FILTER (WHERE l.amount > 0)
FROM public.leads l
WHERE nullif(trim(l.tariff), '') IS NOT NULL
GROUP BY lower(trim(l.tariff))
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  list_price = coalesce(public.products.list_price, EXCLUDED.list_price);

INSERT INTO public.deals (
  id, customer_id, manager_id, product_id, status, lead_date, source, request,
  agreed_amount, expected_net, payment_terms, legacy_status, lost_reason,
  closed_at, legacy_lead_id, created_at, updated_at
)
SELECT
  l.id,
  c.id,
  l.manager_id,
  p.id,
  CASE l.status::text
    WHEN 'new' THEN 'new'::public.deal_status
    WHEN 'in_work' THEN 'in_work'::public.deal_status
    WHEN 'kp_sent' THEN 'offer_sent'::public.deal_status
    WHEN 'paid' THEN 'paid'::public.deal_status
    WHEN 'lost' THEN 'lost'::public.deal_status
    ELSE 'new'::public.deal_status
  END,
  l.lead_date,
  l.source,
  l.request,
  l.amount,
  l.net,
  (
    SELECT pmt.schedule
    FROM public.payments pmt
    WHERE pmt.lead_id = l.id AND nullif(trim(pmt.schedule), '') IS NOT NULL
    ORDER BY pmt.payment_date, pmt.created_at
    LIMIT 1
  ),
  l.raw_status,
  CASE WHEN l.status::text = 'lost' THEN l.comment ELSE NULL END,
  CASE WHEN l.status::text IN ('paid', 'lost') THEN l.updated_at ELSE NULL END,
  l.id,
  l.created_at,
  l.updated_at
FROM public.leads l
JOIN public.customers c ON c.legacy_lead_id = l.id
LEFT JOIN public.products p
  ON p.code = 'legacy-' || substr(md5(lower(trim(l.tariff))), 1, 16)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deal_status_history (
  deal_id, from_status, to_status, comment, changed_at
)
SELECT d.id, NULL, d.status, 'Импортировано из существующей схемы', d.created_at
FROM public.deals d
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_status_history h WHERE h.deal_id = d.id
);

INSERT INTO public.activities (
  deal_id, assignee_id, type, subject, note, created_at, updated_at
)
SELECT
  d.id, d.manager_id, 'task'::public.activity_type,
  'Следующее действие', l.next_action, l.created_at, l.updated_at
FROM public.leads l
JOIN public.deals d ON d.legacy_lead_id = l.id
WHERE nullif(trim(l.next_action), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.deal_id = d.id
      AND a.subject = 'Следующее действие'
      AND a.note IS NOT DISTINCT FROM l.next_action
  );

INSERT INTO public.sales_plans (
  id, period, employee_id, plan_min, plan_target, plan_max, created_at, updated_at
)
SELECT
  p.id, date_trunc('month', p.period)::date, p.employee_id,
  greatest(p.plan_min, 0),
  greatest(p.plan_target, p.plan_min, 0),
  greatest(p.plan_max, p.plan_target, p.plan_min, 0),
  p.created_at, p.created_at
FROM public.plans p
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.compensation_terms (
  employee_id, valid_from, salary, bonus_rate, coef_min, coef_target
)
SELECT e.id, DATE '1900-01-01', e.salary, e.bonus_rate, e.coef_min, e.coef_target
FROM public.employees e
WHERE NOT EXISTS (
  SELECT 1 FROM public.compensation_terms ct WHERE ct.employee_id = e.id
);

-- Evolve payments in place, retaining legacy columns for a verification period.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS credited_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS net_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'RUB',
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS paid_at date,
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.payments
SET
  deal_id = coalesce(deal_id, lead_id),
  credited_employee_id = coalesce(credited_employee_id, manager_id),
  amount = coalesce(amount, CASE WHEN revenue > 0 THEN revenue ELSE NULL END),
  net_amount = coalesce(net_amount, net_profit),
  method = coalesce(method, payment_method),
  paid_at = coalesce(paid_at, payment_date),
  note = coalesce(note, schedule),
  updated_at = coalesce(updated_at, created_at)
WHERE deal_id IS NULL
   OR credited_employee_id IS NULL
   OR amount IS NULL
   OR net_amount IS NULL
   OR method IS NULL
   OR paid_at IS NULL
   OR note IS NULL;

DO $$ BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_amount_positive CHECK (amount IS NULL OR amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sales_plans_employee_period_idx
  ON public.sales_plans (employee_id, period)
  WHERE employee_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_plans_company_period_idx
  ON public.sales_plans (period)
  WHERE employee_id IS NULL;
CREATE INDEX IF NOT EXISTS deals_manager_status_idx
  ON public.deals (manager_id, status, lead_date DESC);
CREATE INDEX IF NOT EXISTS deals_customer_idx
  ON public.deals (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_assignee_due_open_idx
  ON public.activities (assignee_id, due_at)
  WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS payments_paid_at_idx
  ON public.payments (paid_at DESC);
CREATE INDEX IF NOT EXISTS payments_employee_paid_at_idx
  ON public.payments (credited_employee_id, paid_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payments_external_ref_idx
  ON public.payments (external_ref)
  WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS deal_status_history_deal_changed_idx
  ON public.deal_status_history (deal_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_set_updated_at ON public.employees;
CREATE TRIGGER employees_set_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS customers_set_updated_at ON public.customers;
CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS deals_set_updated_at ON public.deals;
CREATE TRIGGER deals_set_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS activities_set_updated_at ON public.activities;
CREATE TRIGGER activities_set_updated_at
BEFORE UPDATE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS sales_plans_set_updated_at ON public.sales_plans;
CREATE TRIGGER sales_plans_set_updated_at
BEFORE UPDATE ON public.sales_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS compensation_terms_set_updated_at ON public.compensation_terms;
CREATE TRIGGER compensation_terms_set_updated_at
BEFORE UPDATE ON public.compensation_terms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_payment_compat_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.amount IS NULL AND NEW.revenue > 0 THEN NEW.amount := NEW.revenue; END IF;
  IF NEW.amount IS NOT NULL THEN NEW.revenue := NEW.amount; END IF;
  IF NEW.net_amount IS NULL THEN NEW.net_amount := NEW.net_profit; END IF;
  IF NEW.net_amount IS NOT NULL THEN NEW.net_profit := NEW.net_amount; END IF;
  NEW.method := coalesce(NEW.method, NEW.payment_method);
  NEW.payment_method := coalesce(NEW.method, NEW.payment_method);
  NEW.paid_at := coalesce(NEW.paid_at, NEW.payment_date, current_date);
  NEW.payment_date := NEW.paid_at;
  NEW.credited_employee_id := coalesce(NEW.credited_employee_id, NEW.manager_id);
  NEW.manager_id := coalesce(NEW.credited_employee_id, NEW.manager_id);
  NEW.deal_id := coalesce(NEW.deal_id, NEW.lead_id);
  NEW.note := coalesce(NEW.note, NEW.schedule);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_compat_columns ON public.payments;
CREATE TRIGGER payments_sync_compat_columns
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_compat_columns();

-- The old lead trigger could otherwise create a zero-value payment.
DROP TRIGGER IF EXISTS leads_sync_payment ON public.leads;

CREATE OR REPLACE FUNCTION public.log_deal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.deal_status_history (
      deal_id, from_status, to_status, changed_by_user_id, changed_at
    )
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status,
      auth.uid(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_log_status_change ON public.deals;
CREATE TRIGGER deals_log_status_change
AFTER INSERT OR UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.log_deal_status_change();

CREATE OR REPLACE FUNCTION public.guard_deal_paid_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid_total numeric;
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    SELECT coalesce(sum(p.amount), 0)
      INTO paid_total
    FROM public.payments p
    WHERE p.deal_id = NEW.id AND p.amount IS NOT NULL;

    IF paid_total <= 0 THEN
      RAISE EXCEPTION 'A paid deal must have at least one positive payment';
    END IF;
    IF coalesce(NEW.agreed_amount, 0) > 0 AND paid_total < NEW.agreed_amount THEN
      RAISE EXCEPTION 'The deal is not fully paid';
    END IF;
    NEW.closed_at := coalesce(NEW.closed_at, now());
  ELSIF NEW.status NOT IN ('paid', 'lost') THEN
    NEW.closed_at := NULL;
  ELSIF NEW.status = 'lost' THEN
    NEW.closed_at := coalesce(NEW.closed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_guard_paid_status ON public.deals;
CREATE TRIGGER deals_guard_paid_status
BEFORE UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.guard_deal_paid_status();

CREATE OR REPLACE FUNCTION public.create_deal_with_customer(
  _full_name text,
  _phone text DEFAULT NULL,
  _telegram text DEFAULT NULL,
  _income_band text DEFAULT NULL,
  _request text DEFAULT NULL,
  _source text DEFAULT 'crm',
  _manager_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_id uuid;
  deal_id uuid;
  target_manager uuid := coalesce(_manager_id, public.current_employee_id());
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF nullif(trim(_full_name), '') IS NULL THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF target_manager IS NULL THEN
    RAISE EXCEPTION 'Manager is required';
  END IF;
  IF NOT public.is_admin() AND target_manager IS DISTINCT FROM public.current_employee_id() THEN
    RAISE EXCEPTION 'Deal access denied';
  END IF;

  INSERT INTO public.customers (full_name, phone, telegram, income_band)
  VALUES (
    trim(_full_name), nullif(trim(_phone), ''), nullif(trim(_telegram), ''),
    nullif(trim(_income_band), '')
  )
  RETURNING id INTO customer_id;

  INSERT INTO public.deals (
    customer_id, manager_id, status, lead_date, source, request
  )
  VALUES (
    customer_id, target_manager, 'new', current_date,
    coalesce(nullif(trim(_source), ''), 'crm'), nullif(trim(_request), '')
  )
  RETURNING id INTO deal_id;

  RETURN deal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_deal_with_customer(text, text, text, text, text, text, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_employee_compensation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.compensation_terms (
    employee_id, valid_from, salary, bonus_rate, coef_min, coef_target
  ) VALUES (
    NEW.id, date_trunc('month', current_date)::date,
    NEW.salary, NEW.bonus_rate, NEW.coef_min, NEW.coef_target
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_seed_compensation ON public.employees;
CREATE TRIGGER employees_seed_compensation
AFTER INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.seed_employee_compensation();

CREATE OR REPLACE FUNCTION public.set_employee_compensation(
  _employee_id uuid,
  _valid_from date,
  _salary numeric,
  _bonus_rate numeric,
  _coef_min numeric,
  _coef_target numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  term_id uuid;
  month_start date := date_trunc('month', _valid_from)::date;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF _salary < 0 OR _bonus_rate < 0 OR _coef_min < 0 OR _coef_target < 0 THEN
    RAISE EXCEPTION 'Compensation values cannot be negative';
  END IF;

  UPDATE public.compensation_terms
  SET valid_to = month_start - 1
  WHERE employee_id = _employee_id
    AND valid_from < month_start
    AND (valid_to IS NULL OR valid_to >= month_start);

  INSERT INTO public.compensation_terms (
    employee_id, valid_from, salary, bonus_rate, coef_min, coef_target
  ) VALUES (
    _employee_id, month_start, _salary, _bonus_rate, _coef_min, _coef_target
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO term_id;

  IF term_id IS NULL THEN
    UPDATE public.compensation_terms
    SET salary = _salary,
        bonus_rate = _bonus_rate,
        coef_min = _coef_min,
        coef_target = _coef_target
    WHERE employee_id = _employee_id AND valid_from = month_start
    RETURNING id INTO term_id;
  END IF;

  UPDATE public.employees
  SET salary = _salary,
      bonus_rate = _bonus_rate,
      coef_min = _coef_min,
      coef_target = _coef_target
  WHERE id = _employee_id;

  RETURN term_id;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS compensation_terms_employee_start_idx
  ON public.compensation_terms (employee_id, valid_from);

GRANT EXECUTE ON FUNCTION public.set_employee_compensation(uuid, date, numeric, numeric, numeric, numeric)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.record_deal_payment(
  _deal_id uuid,
  _amount numeric,
  _paid_at date DEFAULT current_date,
  _method text DEFAULT NULL,
  _net_amount numeric DEFAULT 0,
  _note text DEFAULT NULL,
  _mark_paid boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.deals%ROWTYPE;
  customer_name text;
  customer_contact text;
  product_name text;
  payment_id uuid;
  current_emp uuid := public.current_employee_id();
  remaining numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;
  _net_amount := coalesce(_net_amount, 0);

  SELECT * INTO d FROM public.deals WHERE id = _deal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF NOT public.is_admin() AND d.manager_id IS DISTINCT FROM current_emp THEN
    RAISE EXCEPTION 'Payment access denied';
  END IF;

  SELECT c.full_name, coalesce(c.telegram, c.phone)
    INTO customer_name, customer_contact
  FROM public.customers c WHERE c.id = d.customer_id;
  SELECT p.name INTO product_name FROM public.products p WHERE p.id = d.product_id;

  SELECT greatest(coalesce(d.agreed_amount, 0) - coalesce(sum(p.amount), 0) - _amount, 0)
    INTO remaining
  FROM public.payments p
  WHERE p.deal_id = d.id AND p.amount IS NOT NULL;

  INSERT INTO public.payments (
    client_name, contact, tariff, revenue, net_profit, receivable,
    payment_method, payment_date, schedule, manager_id, lead_id,
    deal_id, credited_employee_id, amount, net_amount, currency,
    method, paid_at, note
  ) VALUES (
    customer_name, customer_contact, product_name, _amount, _net_amount, remaining,
    _method, coalesce(_paid_at, current_date), d.payment_terms, d.manager_id, d.legacy_lead_id,
    d.id, d.manager_id, _amount, _net_amount, 'RUB',
    _method, coalesce(_paid_at, current_date), _note
  )
  RETURNING id INTO payment_id;

  IF _mark_paid THEN
    UPDATE public.deals
    SET status = 'paid', closed_at = coalesce(closed_at, now())
    WHERE id = d.id;
  END IF;

  RETURN payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_deal_payment(uuid, numeric, date, text, numeric, text, boolean)
  TO authenticated;

CREATE OR REPLACE VIEW public.deal_payment_totals
WITH (security_invoker = true)
AS
SELECT
  d.id AS deal_id,
  d.agreed_amount,
  coalesce(sum(p.amount) FILTER (WHERE p.amount IS NOT NULL), 0)::numeric(14,2) AS paid_amount,
  greatest(
    coalesce(d.agreed_amount, 0) - coalesce(sum(p.amount) FILTER (WHERE p.amount IS NOT NULL), 0),
    0
  )::numeric(14,2) AS remaining_amount
FROM public.deals d
LEFT JOIN public.payments p ON p.deal_id = d.id
GROUP BY d.id, d.agreed_amount;

GRANT SELECT ON public.deal_payment_totals TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT SELECT ON public.deal_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compensation_terms TO authenticated;
GRANT ALL ON public.customers, public.products, public.deals, public.deal_status_history,
  public.activities, public.sales_plans, public.compensation_terms TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers read" ON public.customers;
CREATE POLICY "customers read" ON public.customers FOR SELECT TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.customer_id = customers.id
      AND d.manager_id = public.current_employee_id()
  )
);
DROP POLICY IF EXISTS "customers insert" ON public.customers;
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.current_employee_id() IS NOT NULL);
DROP POLICY IF EXISTS "customers update" ON public.customers;
CREATE POLICY "customers update" ON public.customers FOR UPDATE TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.customer_id = customers.id
      AND d.manager_id = public.current_employee_id()
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.customer_id = customers.id
      AND d.manager_id = public.current_employee_id()
  )
);
DROP POLICY IF EXISTS "customers delete" ON public.customers;
CREATE POLICY "customers delete" ON public.customers FOR DELETE TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "products read" ON public.products;
CREATE POLICY "products read" ON public.products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "products admin write" ON public.products;
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "deals read" ON public.deals;
CREATE POLICY "deals read" ON public.deals FOR SELECT TO authenticated
USING (public.is_admin() OR manager_id = public.current_employee_id());
DROP POLICY IF EXISTS "deals insert" ON public.deals;
CREATE POLICY "deals insert" ON public.deals FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR manager_id = public.current_employee_id());
DROP POLICY IF EXISTS "deals update" ON public.deals;
CREATE POLICY "deals update" ON public.deals FOR UPDATE TO authenticated
USING (public.is_admin() OR manager_id = public.current_employee_id())
WITH CHECK (public.is_admin() OR manager_id = public.current_employee_id());
DROP POLICY IF EXISTS "deals delete" ON public.deals;
CREATE POLICY "deals delete" ON public.deals FOR DELETE TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "deal history read" ON public.deal_status_history;
CREATE POLICY "deal history read" ON public.deal_status_history FOR SELECT TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = deal_status_history.deal_id
      AND d.manager_id = public.current_employee_id()
  )
);

DROP POLICY IF EXISTS "activities read" ON public.activities;
CREATE POLICY "activities read" ON public.activities FOR SELECT TO authenticated
USING (
  public.is_admin() OR assignee_id = public.current_employee_id() OR EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = activities.deal_id
      AND d.manager_id = public.current_employee_id()
  )
);
DROP POLICY IF EXISTS "activities insert" ON public.activities;
CREATE POLICY "activities insert" ON public.activities FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR assignee_id = public.current_employee_id());
DROP POLICY IF EXISTS "activities update" ON public.activities;
CREATE POLICY "activities update" ON public.activities FOR UPDATE TO authenticated
USING (public.is_admin() OR assignee_id = public.current_employee_id())
WITH CHECK (public.is_admin() OR assignee_id = public.current_employee_id());
DROP POLICY IF EXISTS "activities delete" ON public.activities;
CREATE POLICY "activities delete" ON public.activities FOR DELETE TO authenticated
USING (public.is_admin() OR assignee_id = public.current_employee_id());

DROP POLICY IF EXISTS "sales plans read" ON public.sales_plans;
CREATE POLICY "sales plans read" ON public.sales_plans FOR SELECT TO authenticated
USING (public.is_admin() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "sales plans admin write" ON public.sales_plans;
CREATE POLICY "sales plans admin write" ON public.sales_plans FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "compensation read" ON public.compensation_terms;
CREATE POLICY "compensation read" ON public.compensation_terms FOR SELECT TO authenticated
USING (public.is_admin() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "compensation admin write" ON public.compensation_terms;
CREATE POLICY "compensation admin write" ON public.compensation_terms FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payments read" ON public.payments;
CREATE POLICY "payments read" ON public.payments FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR credited_employee_id = public.current_employee_id()
  OR manager_id = public.current_employee_id()
  OR EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = payments.deal_id
      AND d.manager_id = public.current_employee_id()
  )
);
DROP POLICY IF EXISTS "payments insert" ON public.payments;
CREATE POLICY "payments insert" ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR credited_employee_id = public.current_employee_id()
  OR manager_id = public.current_employee_id()
);
DROP POLICY IF EXISTS "payments update" ON public.payments;
CREATE POLICY "payments update" ON public.payments FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR credited_employee_id = public.current_employee_id()
  OR manager_id = public.current_employee_id()
)
WITH CHECK (
  public.is_admin()
  OR credited_employee_id = public.current_employee_id()
  OR manager_id = public.current_employee_id()
);
DROP POLICY IF EXISTS "payments delete" ON public.payments;
CREATE POLICY "payments delete" ON public.payments FOR DELETE TO authenticated
USING (public.is_admin());
