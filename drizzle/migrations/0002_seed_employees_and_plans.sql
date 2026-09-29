INSERT INTO public.employees (email,name,role,salary,bonus_rate,coef_min,coef_target) VALUES
  ('vasya@crm.test','Вася','admin',120000,3,1.1,1.25),
  ('alina@crm.test','Алина','manager',60000,5,1.2,1.5),
  ('pasha@crm.test','Паша','manager',60000,5,1.2,1.5)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.plans (period, employee_id, plan_min, plan_target, plan_max)
SELECT date_trunc('month', current_date)::date, e.id, 1000000, 1500000, 2000000
FROM public.employees e WHERE e.email IN ('alina@crm.test','pasha@crm.test');

INSERT INTO public.plans (period, employee_id, plan_min, plan_target, plan_max)
VALUES (date_trunc('month', current_date)::date, NULL, 2000000, 3000000, 4000000);