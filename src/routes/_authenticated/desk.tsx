import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { defaultPaymentMonth, nextMonthStart, usePaymentMonths } from "@/hooks/use-payment-months";
import { AppShell } from "@/components/AppShell";
import { MonthSelect } from "@/components/MonthSelect";
import { calcBonus, money, monthLabel, STATUS_LABEL, type LeadStatus } from "@/lib/crm";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/desk")({
  head: () => ({
    meta: [
      { title: "Рабочий стол — Финпланер CRM" },
      { name: "description", content: "Личный план менеджера: заявки на сегодня, премия и коэффициенты." },
      { property: "og:title", content: "Рабочий стол — Финпланер CRM" },
      { property: "og:description", content: "Личный план менеджера и премия." },
    ],
  }),
  component: DeskPage,
});

function DeskPage() {
  const { data: me } = useMe();
  const { data: paymentMonths = [] } = usePaymentMonths();
  const [periodOverride, setPeriodOverride] = useState<string | null>(null);
  const period = periodOverride ?? defaultPaymentMonth(paymentMonths);
  const nextMonth = nextMonthStart(period);
  const employeeId = me?.employee?.id;

  const { data } = useQuery({
    queryKey: ["desk", employeeId, period],
    enabled: !!employeeId,
    queryFn: async () => {
      if (!employeeId) return { leads: [], payments: [], plan: undefined };
      const [leadsRes, paymentsRes, planRes] = await Promise.all([
        supabase.from("leads").select("*").eq("manager_id", employeeId),
        supabase
          .from("payments")
          .select("revenue, payment_date, client_name")
          .eq("manager_id", employeeId)
          .gte("payment_date", period)
          .lt("payment_date", nextMonth),
        supabase.from("plans").select("*").eq("period", period).eq("employee_id", employeeId),
      ]);
      return {
        leads: (leadsRes.data ?? []) as {
          id: string;
          name: string;
          status: LeadStatus;
          next_action: string | null;
          lead_date: string | null;
          amount: number | null;
        }[],
        payments: (paymentsRes.data ?? []) as {
          revenue: number;
          payment_date: string;
          client_name: string;
        }[],
        plan: planRes.data?.[0] as { plan_min: number; plan_target: number; plan_max: number } | undefined,
      };
    },
  });

  const emp = me?.employee;
  const revenue = (data?.payments ?? []).reduce((a, p) => a + Number(p.revenue), 0);
  const bonus = calcBonus({
    revenue,
    salary: Number(emp?.salary ?? 0),
    bonusRate: Number(emp?.bonus_rate ?? 0),
    coefMin: Number(emp?.coef_min ?? 1),
    coefTarget: Number(emp?.coef_target ?? 1),
    planMin: Number(data?.plan?.plan_min ?? 0),
    planTarget: Number(data?.plan?.plan_target ?? 0),
  });

  const today = new Date().toISOString().slice(0, 10);
  const open = (data?.leads ?? []).filter((l) => ["new", "in_work", "kp_sent"].includes(l.status));
  const todayLeads = open.filter((l) => l.lead_date === today);

  return (
    <AppShell
      title={`Рабочий стол · ${emp?.name ?? ""}`}
      subtitle={`Период: ${monthLabel(period)}`}
      actions={<MonthSelect value={period} months={paymentMonths} onChange={setPeriodOverride} />}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Выручка за месяц</div>
              <div className="stat-value mt-1">{money(revenue)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground">Целевой план</div>
              <div className="stat-value mt-1">{money(data?.plan?.plan_target ?? 0)}</div>
            </div>
          </div>
          <Progress value={bonus.progress} className="mt-4" />
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="text-muted-foreground">
              До плана-минимума: <span className="text-foreground">{money(bonus.toMin)}</span>
            </div>
            <div className="text-muted-foreground">
              До целевого плана: <span className="text-foreground">{money(bonus.toTarget)}</span>
            </div>
          </div>
          {bonus.nextCoef ? (
            <p className="mt-3 rounded-lg bg-secondary p-3 text-sm">
              Ещё {money(bonus.toNextCoef)} — и коэффициент премии вырастет до ×{bonus.nextCoef}.
            </p>
          ) : (
            <p className="mt-3 rounded-lg bg-secondary p-3 text-sm">
              Целевой план выполнен, действует максимальный коэффициент ×{bonus.coef}.
            </p>
          )}
        </div>

        <div className="panel p-5">
          <div className="text-xs uppercase text-muted-foreground">Расчёт на сейчас</div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Оклад" value={money(emp?.salary ?? 0)} />
            <Row label={`Премия ${emp?.bonus_rate ?? 0}%`} value={money(bonus.baseBonus)} />
            <Row label={`Коэффициент (${bonus.coefLabel})`} value={`×${bonus.coef}`} />
            <Row label="Премия к начислению" value={money(bonus.bonus)} />
            <div className="border-t border-border pt-2">
              <Row label="Итого к выплате" value={money(bonus.payout)} strong />
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold">Заявки на сегодня</h2>
          <p className="text-xs text-muted-foreground">Поступившие {today}</p>
          <ul className="mt-3 space-y-2">
            {todayLeads.length === 0 ? (
              <li className="text-sm text-muted-foreground">Новых заявок сегодня нет.</li>
            ) : (
              todayLeads.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                >
                  <span>{l.name}</span>
                  <span className="text-xs text-muted-foreground">{STATUS_LABEL[l.status]}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Заявки в работе ({open.length})</h2>
            <Link to="/board" className="text-xs text-primary hover:underline">
              Открыть доску
            </Link>
          </div>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {open.slice(0, 40).map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-2 text-sm"
              >
                <span>{l.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {l.next_action || STATUS_LABEL[l.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-display text-lg font-semibold text-primary" : "font-medium"}>
        {value}
      </dd>
    </div>
  );
}
