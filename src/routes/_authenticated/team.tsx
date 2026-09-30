import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type Employee } from "@/hooks/use-me";
import { AppShell } from "@/components/AppShell";
import { calcBonus, money, monthStart } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Сотрудники — Финпланер CRM" },
      { name: "description", content: "Оклады, ставки премий и повышающие коэффициенты команды продаж." },
      { property: "og:title", content: "Сотрудники — Финпланер CRM" },
      { property: "og:description", content: "Оклады, премии и коэффициенты команды." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const period = monthStart();

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments-period", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("revenue, manager_id")
        .gte("payment_date", period);
      return (data ?? []) as { revenue: number; manager_id: string | null }[];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans", period],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("period", period);
      return (data ?? []) as { employee_id: string | null; plan_min: number; plan_target: number }[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (emp: Partial<Employee> & { id?: string }) => {
      if (emp.id) {
        const { id, ...rest } = emp;
        const { error } = await supabase.from("employees").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert(emp as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      toast.success("Данные сотрудника сохранены");
    },
    onError: (e: Error) => toast.error("Не удалось сохранить", { description: e.message }),
  });

  if (me && !me.isAdmin) {
    return (
      <AppShell title="Сотрудники" subtitle="Раздел доступен только руководителю">
        <div className="panel p-6 text-sm text-muted-foreground">
          У вас роль менеджера — управление командой недоступно.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Сотрудники"
      subtitle="Оклады, ставки премий и повышающие коэффициенты"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Добавить сотрудника
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый сотрудник</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                upsert.mutate({
                  name: String(f.get("name")),
                  email: String(f.get("email") || "") || null,
                  role: (f.get("role") as "admin" | "manager") || "manager",
                  salary: Number(f.get("salary") || 0),
                  bonus_rate: Number(f.get("bonus_rate") || 0),
                  coef_min: Number(f.get("coef_min") || 1),
                  coef_target: Number(f.get("coef_target") || 1),
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Имя</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Почта для входа</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="role">Роль</Label>
                  <select
                    id="role"
                    name="role"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue="manager"
                  >
                    <option value="manager">Менеджер</option>
                    <option value="admin">Руководитель</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="salary">Оклад, ₽</Label>
                  <Input id="salary" name="salary" type="number" defaultValue={60000} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="bonus_rate">Базовая ставка премии, %</Label>
                  <Input id="bonus_rate" name="bonus_rate" type="number" step="0.1" defaultValue={5} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="coef_min">Коэф. при плане-минимум</Label>
                  <Input id="coef_min" name="coef_min" type="number" step="0.05" defaultValue={1.2} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="coef_target">Коэф. при целевом плане</Label>
                  <Input
                    id="coef_target"
                    name="coef_target"
                    type="number"
                    step="0.05"
                    defaultValue={1.5}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={upsert.isPending}>
                  Добавить
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <p className="mb-4 text-xs text-muted-foreground">
        Чтобы сотрудник смог войти, он регистрируется с указанной здесь почтой — система свяжет
        аккаунт с карточкой автоматически.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
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
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  upsert.mutate({
                    id: emp.id,
                    name: String(f.get("name")),
                    salary: Number(f.get("salary") || 0),
                    bonus_rate: Number(f.get("bonus_rate") || 0),
                    coef_min: Number(f.get("coef_min") || 1),
                    coef_target: Number(f.get("coef_target") || 1),
                  });
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <Input name="name" defaultValue={emp.name} className="max-w-[220px] font-medium" />
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    {emp.role === "admin" ? "Руководитель" : "Менеджер"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Оклад, ₽</Label>
                    <Input name="salary" type="number" defaultValue={emp.salary} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Ставка премии, %</Label>
                    <Input name="bonus_rate" type="number" step="0.1" defaultValue={emp.bonus_rate} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Коэф. минимум</Label>
                    <Input name="coef_min" type="number" step="0.05" defaultValue={emp.coef_min} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Коэф. цель</Label>
                    <Input
                      name="coef_target"
                      type="number"
                      step="0.05"
                      defaultValue={emp.coef_target}
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-secondary p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Выручка за месяц</span>
                    <span>{money(revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Премия (×{bonus.coef})</span>
                    <span>{money(bonus.bonus)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1">
                    <span className="text-muted-foreground">Итого к выплате</span>
                    <span className="font-semibold text-primary">{money(bonus.payout)}</span>
                  </div>
                </div>
                <Button type="submit" variant="secondary">
                  Сохранить
                </Button>
              </form>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
