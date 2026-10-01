import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/AppShell";
import { calcBonus, money, monthLabel, monthStart, shortMoney } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { Employee } from "@/hooks/use-me";

type Plan = {
  id: string;
  period: string;
  employee_id: string | null;
  plan_min: number;
  plan_target: number;
  plan_max: number;
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Планы и премии — Финпланер CRM" },
      { name: "description", content: "Сводный дашборд руководителя: выполнение планов и премии команды." },
      { property: "og:title", content: "Планы и премии — Финпланер CRM" },
      { property: "og:description", content: "Сводный дашборд руководителя." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [periodOverride, setPeriod] = useState<string | null>(null);

  const { data: lastPaymentMonth } = useQuery({
    queryKey: ["last-payment-month"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("payment_date")
        .order("payment_date", { ascending: false })
        .limit(1);
      const latest = data?.[0]?.payment_date;
      return latest ? `${latest.slice(0, 7)}-01` : monthStart();
    },
  });

  const period = periodOverride ?? lastPaymentMonth ?? monthStart();


  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans", period],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("period", period);
      return (data ?? []) as Plan[];
    },
  });

  const nextMonth = useMemo(() => {
    const d = new Date(`${period}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const { data: payments = [] } = useQuery({
    queryKey: ["payments-period", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("revenue, net_profit, payment_date, manager_id")
        .gte("payment_date", period)
        .lt("payment_date", nextMonth);
      return (data ?? []) as {
        revenue: number;
        net_profit: number;
        payment_date: string;
        manager_id: string | null;
      }[];
    },
  });

  const savePlan = useMutation({
    mutationFn: async (p: {
      employee_id: string | null;
      plan_min: number;
      plan_target: number;
      plan_max: number;
    }) => {
      const existing = plans.find((x) => x.employee_id === p.employee_id);
      if (existing) {
        const { error } = await supabase
          .from("plans")
          .update({ plan_min: p.plan_min, plan_target: p.plan_target, plan_max: p.plan_max })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans").insert({ ...p, period } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans", period] });
      toast.success("План сохранён");
    },
    onError: (e: Error) => toast.error("Не удалось сохранить план", { description: e.message }),
  });

  if (me && !me.isAdmin) {
    return (
      <AppShell title="Планы" subtitle="Раздел доступен только руководителю">
        <div className="panel p-6 text-sm text-muted-foreground">
          У вас роль менеджера — сводные планы команды недоступны. Ваш личный план виден на рабочем
          столе.
        </div>
      </AppShell>
    );
  }

  const companyPlan = plans.find((p) => p.employee_id === null);
  const totalRevenue = payments.reduce((a, p) => a + Number(p.revenue), 0);
  const totalNet = payments.reduce((a, p) => a + Number(p.net_profit), 0);
  const companyProgress = companyPlan?.plan_target
    ? Math.min(100, (totalRevenue / Number(companyPlan.plan_target)) * 100)
    : 0;

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of payments) {
      byDay.set(p.payment_date, (byDay.get(p.payment_date) ?? 0) + Number(p.revenue));
    }
    let cumulative = 0;
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => {
        cumulative += value;
        return { date: date.slice(8), day: value, total: cumulative };
      });
  }, [payments]);

  return (
    <AppShell
      title="Планирование и премии"
      subtitle={monthLabel(period)}
      actions={
        <div className="flex items-end gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Период</Label>
            <Input
              type="month"
              value={period.slice(0, 7)}
              onChange={(e) => setPeriod(`${e.target.value}-01`)}
              className="w-40"
            />
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Выручка за период" value={money(totalRevenue)} />
        <Stat title="Чистая прибыль" value={money(totalNet)} />
        <Stat title="Целевой план компании" value={money(companyPlan?.plan_target ?? 0)} />
        <Stat title="Выполнение" value={`${companyProgress.toFixed(0)}%`} />
      </div>

      <div className="mt-4 panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Динамика поступления денег</h2>
          <span className="text-xs text-muted-foreground">Накопительным итогом</span>
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickFormatter={(v) => shortMoney(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--popover-foreground)",
                }}
                formatter={(v: number | string) => money(Number(v))}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 panel p-5">
        <h2 className="text-sm font-semibold">План компании на {monthLabel(period)}</h2>
        <PlanForm
          plan={companyPlan}
          onSave={(v) => savePlan.mutate({ employee_id: null, ...v })}
        />
        <Progress value={companyProgress} className="mt-4" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {employees.map((emp) => {
          const plan = plans.find((p) => p.employee_id === emp.id);
          const revenue = payments
            .filter((p) => p.manager_id === emp.id)
            .reduce((a, p) => a + Number(p.revenue), 0);
          const bonus = calcBonus({
            revenue,
            salary: Number(emp.salary),
            bonusRate: Number(emp.bonus_rate),
            coefMin: Number(emp.coef_min),
            coefTarget: Number(emp.coef_target),
            planMin: Number(plan?.plan_min ?? 0),
            planTarget: Number(plan?.plan_target ?? 0),
          });
          return (
            <div key={emp.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">{emp.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {emp.role === "admin" ? "Руководитель" : "Менеджер"} · оклад{" "}
                    {money(emp.salary)} · ставка {emp.bonus_rate}%
                  </p>
                </div>
                <div className="text-right">
                  <div className="stat-value">{money(revenue)}</div>
                  <div className="text-xs text-muted-foreground">выручка за период</div>
                </div>
              </div>
              <Progress value={bonus.progress} className="mt-3" />
              <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                <span className="text-muted-foreground">
                  Коэффициент: <span className="text-foreground">×{bonus.coef}</span> (
                  {bonus.coefLabel})
                </span>
                <span className="text-muted-foreground">
                  Премия: <span className="text-foreground">{money(bonus.bonus)}</span>
                </span>
                <span className="text-muted-foreground">
                  До минимума: <span className="text-foreground">{money(bonus.toMin)}</span>
                </span>
                <span className="text-muted-foreground">
                  К выплате: <span className="text-primary">{money(bonus.payout)}</span>
                </span>
              </div>
              <PlanForm plan={plan} onSave={(v) => savePlan.mutate({ employee_id: emp.id, ...v })} />
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function PlanForm({
  plan,
  onSave,
}: {
  plan: Plan | undefined;
  onSave: (v: { plan_min: number; plan_target: number; plan_max: number }) => void;
}) {
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          plan_min: Number(f.get("plan_min") || 0),
          plan_target: Number(f.get("plan_target") || 0),
          plan_max: Number(f.get("plan_max") || 0),
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">План-минимум</Label>
        <Input name="plan_min" type="number" defaultValue={plan?.plan_min ?? 0} className="w-36" />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Целевой план</Label>
        <Input
          name="plan_target"
          type="number"
          defaultValue={plan?.plan_target ?? 0}
          className="w-36"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">План-максимум</Label>
        <Input name="plan_max" type="number" defaultValue={plan?.plan_max ?? 0} className="w-36" />
      </div>
      <Button type="submit" variant="secondary">
        Сохранить план
      </Button>
    </form>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="stat-value mt-1">{value}</div>
    </div>
  );
}
