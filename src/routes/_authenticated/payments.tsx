import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { money, monthStart } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Payment = {
  id: string;
  dealId: string | null;
  clientName: string;
  tariff: string | null;
  amount: number;
  netAmount: number;
  method: string | null;
  paidAt: string;
  note: string | null;
  employeeId: string | null;
};

type DealOption = {
  id: string;
  name: string;
  managerId: string | null;
  amount: number | null;
};

type PaymentDraft = {
  dealId: string;
  amount: number;
  netAmount: number;
  method: string;
  paidAt: string;
  note: string;
};

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Оплаты — Финпланер CRM" },
      { name: "description", content: "Фактически поступившие платежи по сделкам." },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Payment | null>(null);

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, deal_id, client_name, tariff, amount, net_amount, method, paid_at, note, credited_employee_id",
        )
        .not("amount", "is", null)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((payment): Payment => ({
        id: payment.id,
        dealId: payment.deal_id,
        clientName: payment.client_name,
        tariff: payment.tariff,
        amount: Number(payment.amount ?? 0),
        netAmount: Number(payment.net_amount ?? 0),
        method: payment.method,
        paidAt: payment.paid_at ?? "",
        note: payment.note,
        employeeId: payment.credited_employee_id,
      }));
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["payment-deal-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, manager_id, agreed_amount, customer:customers(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((deal) => ({
        id: deal.id,
        name: (deal.customer as { full_name: string } | null)?.full_name ?? "Без имени",
        managerId: deal.manager_id,
        amount: deal.agreed_amount,
      })) as DealOption[];
    },
  });

  const nameById = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee.name])),
    [employees],
  );

  const create = useMutation({
    mutationFn: async (draft: PaymentDraft) => {
      const { error } = await supabase.rpc("record_deal_payment", {
        _deal_id: draft.dealId,
        _amount: draft.amount,
        _paid_at: draft.paidAt,
        _method: draft.method || null,
        _net_amount: draft.netAmount,
        _note: draft.note || null,
        _mark_paid: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["payment-months"] });
      setOpen(false);
      toast.success("Платёж добавлен");
    },
    onError: (error: Error) =>
      toast.error("Не удалось добавить платёж", { description: error.message }),
  });

  const update = useMutation({
    mutationFn: async (payment: Payment) => {
      const { error } = await supabase
        .from("payments")
        .update({
          amount: payment.amount,
          net_amount: payment.netAmount,
          method: payment.method,
          paid_at: payment.paidAt,
          note: payment.note,
        })
        .eq("id", payment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["payment-months"] });
      setSelected(null);
      toast.success("Платёж сохранён");
    },
    onError: (error: Error) =>
      toast.error("Не удалось сохранить платёж", { description: error.message }),
  });

  const filtered = payments.filter((payment) =>
    `${payment.clientName} ${payment.tariff ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const period = monthStart();
  const inMonth = payments.filter((payment) => payment.paidAt >= period);
  const revenue = payments.reduce((total, payment) => total + payment.amount, 0);
  const net = payments.reduce((total, payment) => total + payment.netAmount, 0);
  const monthRevenue = inMonth.reduce((total, payment) => total + payment.amount, 0);

  return (
    <AppShell
      title="Оплаты"
      subtitle={`${payments.length} платежей · средний чек ${money(payments.length ? revenue / payments.length : 0)}`}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Внести оплату
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая оплата</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                create.mutate({
                  dealId: String(form.get("deal_id")),
                  amount: Number(form.get("amount") || 0),
                  netAmount: Number(form.get("net_amount") || 0),
                  method: String(form.get("method") || ""),
                  paidAt: String(form.get("paid_at")),
                  note: String(form.get("note") || ""),
                });
              }}
            >
              <Field label="Сделка">
                <select
                  name="deal_id"
                  required
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Выберите сделку
                  </option>
                  {deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.name}
                      {deal.amount ? ` · ${money(deal.amount)}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Сумма, ₽">
                  <Input name="amount" type="number" min="0.01" step="0.01" required />
                </Field>
                <Field label="Чистыми, ₽">
                  <Input name="net_amount" type="number" min="0" step="0.01" defaultValue={0} />
                </Field>
                <Field label="Дата">
                  <Input
                    name="paid_at"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </Field>
                <Field label="Способ">
                  <Input name="method" placeholder="Перевод, карта…" />
                </Field>
              </div>
              <Field label="Комментарий">
                <Textarea name="note" rows={2} />
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  Добавить
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Выручка за всё время" value={money(revenue)} />
        <Stat title="Чистыми" value={money(net)} />
        <Stat title="Выручка в этом месяце" value={money(monthRevenue)} />
        <Stat title="Количество платежей" value={String(payments.length)} />
      </div>

      <div className="mt-4 panel overflow-hidden">
        <div className="border-b border-border p-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по клиенту или тарифу"
            className="max-w-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Дата</th>
                <th className="p-3">Клиент</th>
                <th className="p-3">Менеджер</th>
                <th className="p-3">Способ</th>
                <th className="p-3 text-right">Сумма</th>
                <th className="p-3 text-right">Чистыми</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((payment) => (
                <tr
                  key={payment.id}
                  onClick={() => setSelected(payment)}
                  className="cursor-pointer border-t border-border hover:bg-secondary/40"
                >
                  <td className="p-3">{payment.paidAt}</td>
                  <td className="p-3">
                    <div className="font-medium">{payment.clientName}</div>
                    <div className="text-xs text-muted-foreground">{payment.tariff || "—"}</div>
                  </td>
                  <td className="p-3">
                    {payment.employeeId ? (nameById[payment.employeeId] ?? "—") : "—"}
                  </td>
                  <td className="p-3">{payment.method || "—"}</td>
                  <td className="p-3 text-right font-medium">{money(payment.amount)}</td>
                  <td className="p-3 text-right">{money(payment.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(dialogOpen) => !dialogOpen && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Платёж · {selected?.clientName}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                update.mutate(selected);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Сумма, ₽">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={selected.amount}
                    onChange={(event) =>
                      setSelected({ ...selected, amount: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Чистыми, ₽">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selected.netAmount}
                    onChange={(event) =>
                      setSelected({ ...selected, netAmount: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Дата">
                  <Input
                    type="date"
                    value={selected.paidAt}
                    onChange={(event) => setSelected({ ...selected, paidAt: event.target.value })}
                  />
                </Field>
                <Field label="Способ">
                  <Input
                    value={selected.method ?? ""}
                    onChange={(event) => setSelected({ ...selected, method: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="Комментарий">
                <Textarea
                  rows={2}
                  value={selected.note ?? ""}
                  onChange={(event) => setSelected({ ...selected, note: event.target.value })}
                />
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={update.isPending}>
                  Сохранить
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
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
