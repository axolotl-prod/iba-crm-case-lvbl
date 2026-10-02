import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/AppShell";
import { money, monthStart } from "@/lib/crm";
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

type Payment = {
  id: string;
  order_no: number | null;
  client_name: string;
  contact: string | null;
  tariff: string | null;
  revenue: number;
  net_profit: number;
  receivable: number;
  payment_method: string | null;
  payment_date: string;
  schedule: string | null;
  manager_id: string | null;
  lead_id: string | null;
};

type LeadOption = { id: string; name: string; manager_id: string | null };

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Оплаты — Финпланер CRM" },
      { name: "description", content: "Таблица оплат клиентов с выручкой, прибылью и дебиторкой." },
      { property: "og:title", content: "Оплаты — Финпланер CRM" },
      { property: "og:description", content: "Таблица оплат клиентов." },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Payment | null>(null);

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const nameById = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e.name])),
    [employees],
  );

  const { data: leads = [] } = useQuery({
    queryKey: ["payment-lead-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("id, name, manager_id").order("name");
      if (error) throw error;
      return (data ?? []) as LeadOption[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<Payment>) => {
      const { error } = await supabase
        .from("payments")
        .insert({ ...payload, manager_id: me?.employee?.id ?? null } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["payment-months"] });
      setOpen(false);
      toast.success("Оплата добавлена");
    },
    onError: (e: Error) => toast.error("Не удалось добавить оплату", { description: e.message }),
  });

  const update = useMutation({
    mutationFn: async (payment: Payment) => {
      const { id, ...values } = payment;
      const { error } = await supabase.from("payments").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["payment-months"] });
      setSelected(null);
      toast.success("Оплата сохранена");
    },
    onError: (e: Error) => toast.error("Не удалось сохранить оплату", { description: e.message }),
  });

  const filtered = payments.filter((p) =>
    (p.client_name + (p.tariff ?? "")).toLowerCase().includes(search.toLowerCase()),
  );

  const period = monthStart();
  const inMonth = payments.filter((p) => p.payment_date >= period);
  const revenue = payments.reduce((a, p) => a + Number(p.revenue), 0);
  const net = payments.reduce((a, p) => a + Number(p.net_profit), 0);
  const receivable = payments.reduce((a, p) => a + Number(p.receivable), 0);
  const monthRevenue = inMonth.reduce((a, p) => a + Number(p.revenue), 0);

  return (
    <AppShell
      title="Оплаты"
      subtitle={`${payments.length} оплат · средний чек ${money(payments.length ? revenue / payments.length : 0)}`}
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
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                create.mutate({
                  client_name: String(f.get("client_name")),
                  contact: (f.get("contact") as string) || null,
                  tariff: (f.get("tariff") as string) || null,
                  revenue: Number(f.get("revenue") || 0),
                  net_profit: Number(f.get("net_profit") || 0),
                  receivable: Number(f.get("receivable") || 0),
                  payment_method: (f.get("payment_method") as string) || null,
                  payment_date: String(f.get("payment_date")),
                  schedule: (f.get("schedule") as string) || null,
                  lead_id: (f.get("lead_id") as string) || null,
                });
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="client_name">Клиент</Label>
                <Input id="client_name" name="client_name" required />
              </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lead_id">Заявка с доски</Label>
                  <select id="lead_id" name="lead_id" className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Без привязки</option>
                    {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
                  </select>
                </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="contact">Контакт</Label>
                  <Input id="contact" name="contact" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="tariff">Тариф</Label>
                  <Input id="tariff" name="tariff" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="revenue">Выручка, ₽</Label>
                  <Input id="revenue" name="revenue" type="number" required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="net_profit">Чистая прибыль, ₽</Label>
                  <Input id="net_profit" name="net_profit" type="number" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="receivable">Дебиторка, ₽</Label>
                  <Input id="receivable" name="receivable" type="number" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="payment_date">Дата оплаты</Label>
                  <Input
                    id="payment_date"
                    name="payment_date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="payment_method">Способ</Label>
                  <Input id="payment_method" name="payment_method" placeholder="рассрочка" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="schedule">График платежей</Label>
                  <Input id="schedule" name="schedule" placeholder="6 платежей" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  Сохранить
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Stat title="Выручка всего" value={money(revenue)} />
        <Stat title="Выручка за месяц" value={money(monthRevenue)} hint={`${inMonth.length} оплат`} />
        <Stat title="Чистая прибыль" value={money(net)} />
        <Stat title="Дебиторка" value={money(receivable)} />
      </div>

      <div className="mt-6 panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border p-3">
          <Input
            placeholder="Поиск по клиенту или тарифу"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <span className="text-xs text-muted-foreground">{filtered.length} записей</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Клиент</th>
                <th className="px-3 py-2">Тариф</th>
                <th className="px-3 py-2">Менеджер</th>
                <th className="px-3 py-2 text-right">Выручка</th>
                <th className="px-3 py-2 text-right">Чистыми</th>
                <th className="px-3 py-2 text-right">Дебиторка</th>
                <th className="px-3 py-2">Способ</th>
                <th className="px-3 py-2">Дата</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  tabIndex={0}
                  onClick={() => setSelected(p)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setSelected(p);
                  }}
                  className="cursor-pointer border-t border-border hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
                >
                  <td className="px-3 py-2 font-medium">
                    <span className="flex items-center gap-2">
                      {p.lead_id ? <Link2 className="size-3 text-primary" aria-label="Связано с заявкой" /> : null}
                      {p.client_name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.tariff ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.manager_id ? (nameById[p.manager_id] ?? "—") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">{money(p.revenue)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {money(p.net_profit)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {p.receivable ? money(p.receivable) : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.payment_method ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.payment_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(isOpen) => !isOpen && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Карточка оплаты</DialogTitle>
          </DialogHeader>
          {selected ? (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                update.mutate(selected);
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <PaymentField label="Клиент">
                  <Input value={selected.client_name} onChange={(e) => setSelected({ ...selected, client_name: e.target.value })} required />
                </PaymentField>
                <PaymentField label="Контакт">
                  <Input value={selected.contact ?? ""} onChange={(e) => setSelected({ ...selected, contact: e.target.value || null })} />
                </PaymentField>
                <PaymentField label="Заявка с доски">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={selected.lead_id ?? ""}
                    onChange={(e) => {
                      const leadId = e.target.value || null;
                      const lead = leads.find((item) => item.id === leadId);
                      setSelected({
                        ...selected,
                        lead_id: leadId,
                        manager_id: lead?.manager_id ?? selected.manager_id,
                      });
                    }}
                  >
                    <option value="">Без привязки</option>
                    {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
                  </select>
                </PaymentField>
                <PaymentField label="Тариф">
                  <Input value={selected.tariff ?? ""} onChange={(e) => setSelected({ ...selected, tariff: e.target.value || null })} />
                </PaymentField>
                <PaymentField label="Выручка, ₽">
                  <Input type="number" value={selected.revenue} onChange={(e) => setSelected({ ...selected, revenue: Number(e.target.value) })} />
                </PaymentField>
                <PaymentField label="Чистая прибыль, ₽">
                  <Input type="number" value={selected.net_profit} onChange={(e) => setSelected({ ...selected, net_profit: Number(e.target.value) })} />
                </PaymentField>
                <PaymentField label="Дебиторка, ₽">
                  <Input type="number" value={selected.receivable} onChange={(e) => setSelected({ ...selected, receivable: Number(e.target.value) })} />
                </PaymentField>
                <PaymentField label="Дата оплаты">
                  <Input type="date" value={selected.payment_date} onChange={(e) => setSelected({ ...selected, payment_date: e.target.value })} />
                </PaymentField>
                <PaymentField label="Способ оплаты">
                  <Input value={selected.payment_method ?? ""} onChange={(e) => setSelected({ ...selected, payment_method: e.target.value || null })} />
                </PaymentField>
                <PaymentField label="График платежей">
                  <Input value={selected.schedule ?? ""} onChange={(e) => setSelected({ ...selected, schedule: e.target.value || null })} />
                </PaymentField>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={update.isPending}>Сохранить</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function PaymentField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="stat-value mt-1">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
