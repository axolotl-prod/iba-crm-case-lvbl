DROP TRIGGER IF EXISTS leads_sync_payment ON public.leads;

CREATE OR REPLACE FUNCTION public.touch_lead()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

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
  RETURN NULL;
END;
$$;

CREATE TRIGGER leads_touch BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.touch_lead();

CREATE TRIGGER leads_sync_payment AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_from_lead();