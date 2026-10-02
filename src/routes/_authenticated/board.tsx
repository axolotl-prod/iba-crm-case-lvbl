import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/AppShell";
import { STATUS_COLUMNS, money, type LeadStatus } from "@/lib/crm";
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

type Deal = {
  id: string;
  customerId: string;
  productId: string | null;
  activityId: string | null;
  leadDate: string | null;
  name: string;
  phone: string | null;
  telegram: string | null;
  income: string | null;
  request: string | null;
  status: LeadStatus;
  tariff: string | null;
  amount: number | null;
  net: number | null;
  paymentTerms: string | null;
  comment: string | null;
  nextAction: string | null;
  managerId: string | null;
  paidAmount: number;
};

type RawDeal = {
  id: string;
  customer_id: string;
  product_id: string | null;
  lead_date: string | null;
  request: string | null;
  status: LeadStatus;
  agreed_amount: number | null;
  expected_net: number | null;
  payment_terms: string | null;
  lost_reason: string | null;
  manager_id: string | null;
  customer: {
    full_name: string;
    phone: string | null;
    telegram: string | null;
    income_band: string | null;
  } | null;
  product: { name: string } | null;
};

type PaymentDraft = {
  deal: Deal;
  amount: number;
  netAmount: number;
  paidAt: string;
  method: string;
  note: string;
};

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "Канбан сделок — Финпланер CRM" },
      { name: "description", content: "Воронка продаж и работа со сделками." },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);
  const [selected, setSelected] = useState<Deal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const [dealsResult, activitiesResult, paymentsResult] = await Promise.all([
        supabase
          .from("deals")
          .select(
            "*, customer:customers(full_name, phone, telegram, income_band), product:products(name)",
          )
          .order("lead_date", { ascending: false, nullsFirst: false }),
        supabase
          .from("activities")
          .select("id, deal_id, subject, note, due_at, created_at")
          .is("completed_at", null)
          .order("due_at", { ascending: true, nullsFirst: false }),
        supabase.from("payments").select("deal_id, amount").not("amount", "is", null),
      ]);
      if (dealsResult.error) throw dealsResult.error;
      if (activitiesResult.error) throw activitiesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const activityByDeal = new Map<string, { id: string; value: string }>();
      for (const activity of activitiesResult.data ?? []) {
        if (!activityByDeal.has(activity.deal_id)) {
          activityByDeal.set(activity.deal_id, {
            id: activity.id,
            value: activity.note || activity.subject,
          });
        }
      }
      const paidByDeal = new Map<string, number>();
      for (const payment of paymentsResult.data ?? []) {
        if (!payment.deal_id) continue;
        paidByDeal.set(
          payment.deal_id,
          (paidByDeal.get(payment.deal_id) ?? 0) + Number(payment.amount ?? 0),
        );
      }

      return ((dealsResult.data ?? []) as unknown as RawDeal[]).map((deal): Deal => {
        const activity = activityByDeal.get(deal.id);
        return {
          id: deal.id,
          customerId: deal.customer_id,
          productId: deal.product_id,
          activityId: activity?.id ?? null,
          leadDate: deal.lead_date,
          name: deal.customer?.full_name ?? "Без имени",
          phone: deal.customer?.phone ?? null,
          telegram: deal.customer?.telegram ?? null,
          income: deal.customer?.income_band ?? null,
          request: deal.request,
          status: deal.status,
          tariff: deal.product?.name ?? null,
          amount: deal.agreed_amount,
          net: deal.expected_net,
          paymentTerms: deal.payment_terms,
          comment: deal.lost_reason,
          nextAction: activity?.value ?? null,
          managerId: deal.manager_id,
          paidAmount: paidByDeal.get(deal.id) ?? 0,
        };
      });
    },
  });

  const nameById = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee.name])),
    [employees],
  );

  function requestMove(deal: Deal, status: LeadStatus) {
    if (status === deal.status) return;
    if (status === "paid") {
      const remaining = Math.max(0, Number(deal.amount ?? 0) - deal.paidAmount);
      if (deal.paidAmount > 0 && remaining === 0) {
        move.mutate({ id: deal.id, status });
        return;
      }
      setPaymentDraft({
        deal,
        amount: remaining,
        netAmount: Number(deal.net ?? 0),
        paidAt: new Date().toISOString().slice(0, 10),
        method: "",
        note: "",
      });
      return;
    }
    move.mutate({ id: deal.id, status });
  }

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.from("deals").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Статус сделки обновлён");
    },
    onError: (error: Error) =>
      toast.error("Не удалось обновить статус", { description: error.message }),
  });

  const recordPayment = useMutation({
    mutationFn: async (draft: PaymentDraft) => {
      const { error } = await supabase.rpc("record_deal_payment", {
        _deal_id: draft.deal.id,
        _amount: draft.amount,
        _paid_at: draft.paidAt,
        _method: draft.method || null,
        _net_amount: draft.netAmount,
        _note: draft.note || null,
        _mark_paid: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["payment-months"] });
      setPaymentDraft(null);
      toast.success("Платёж записан, сделка переведена в «Оплачено»");
    },
    onError: (error: Error) =>
      toast.error("Не удалось записать платёж", { description: error.message }),
  });

  const save = useMutation({
    mutationFn: async (deal: Deal) => {
      const [customerResult, dealResult] = await Promise.all([
        supabase
          .from("customers")
          .update({
            full_name: deal.name,
            phone: deal.phone || null,
            telegram: deal.telegram || null,
            income_band: deal.income || null,
          })
          .eq("id", deal.customerId),
        supabase
          .from("deals")
          .update({
            status: deal.status,
            product_id: deal.productId,
            request: deal.request,
            agreed_amount: deal.amount,
            expected_net: deal.net,
            payment_terms: deal.paymentTerms,
            lost_reason: deal.comment,
            manager_id: deal.managerId,
          })
          .eq("id", deal.id),
      ]);
      if (customerResult.error) throw customerResult.error;
      if (dealResult.error) throw dealResult.error;

      if (deal.activityId) {
        const { error } = await supabase
          .from("activities")
          .update({ note: deal.nextAction || null })
          .eq("id", deal.activityId);
        if (error) throw error;
      } else if (deal.nextAction) {
        const { error } = await supabase.from("activities").insert({
          deal_id: deal.id,
          assignee_id: deal.managerId,
          type: "task",
          subject: "Следующее действие",
          note: deal.nextAction,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      setSelected(null);
      toast.success("Сделка сохранена");
    },
    onError: (error: Error) =>
      toast.error("Не удалось сохранить сделку", { description: error.message }),
  });

  const create = useMutation({
    mutationFn: async (payload: {
      name: string;
      phone: string | null;
      telegram: string | null;
      income: string | null;
      request: string | null;
    }) => {
      const { error } = await supabase.rpc("create_deal_with_customer", {
        _full_name: payload.name,
        _phone: payload.phone,
        _telegram: payload.telegram,
        _income_band: payload.income,
        _request: payload.request,
        _source: "crm",
        _manager_id: me?.employee?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      setCreateOpen(false);
      toast.success("Сделка добавлена");
    },
    onError: (error: Error) =>
      toast.error("Не удалось добавить сделку", { description: error.message }),
  });

  const totalInWork = deals.filter((deal) =>
    ["new", "in_work", "offer_sent", "awaiting_payment"].includes(deal.status),
  ).length;

  return (
    <AppShell
      fitViewport
      title="Канбан сделок"
      subtitle={
        isLoading
          ? "Загружаем сделки…"
          : `${deals.length} сделок · ${totalInWork} в работе${me?.isAdmin ? " · режим руководителя" : ""}`
      }
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Новая сделка
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая сделка</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                create.mutate({
                  name: String(form.get("name") || "Без имени"),
                  phone: (form.get("phone") as string) || null,
                  telegram: (form.get("telegram") as string) || null,
                  income: (form.get("income") as string) || null,
                  request: (form.get("request") as string) || null,
                });
              }}
            >
              <Field label="Имя клиента">
                <Input name="name" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Телефон">
                  <Input name="phone" />
                </Field>
                <Field label="Telegram">
                  <Input name="telegram" />
                </Field>
              </div>
              <Field label="Доход">
                <Input name="income" />
              </Field>
              <Field label="Запрос">
                <Textarea name="request" rows={3} />
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
      <div className="grid gap-4 md:grid-cols-2 lg:h-full lg:min-h-0 lg:grid-cols-3 xl:grid-cols-6">
        {STATUS_COLUMNS.map((column) => {
          const items = deals.filter((deal) => deal.status === column.key);
          const sum = items.reduce((total, deal) => total + Number(deal.amount ?? 0), 0);
          return (
            <section
              key={column.key}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(column.key);
              }}
              onDragLeave={() => setOver((current) => (current === column.key ? null : current))}
              onDrop={() => {
                setOver(null);
                const deal = deals.find((item) => item.id === dragging);
                if (deal) requestMove(deal, column.key);
                setDragging(null);
              }}
              className={`panel flex min-h-[320px] flex-col p-3 transition-colors lg:min-h-0 lg:overflow-hidden ${over === column.key ? "border-primary bg-surface-2" : ""}`}
            >
              <header className="mb-3 px-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{column.title}</h2>
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {sum > 0 ? money(sum) : column.hint}
                </p>
              </header>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pr-1 lg:min-h-0">
                {items.map((deal) => (
                  <article
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragging(deal.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => setSelected(deal)}
                    className={`cursor-grab rounded-lg border border-border bg-card p-3 text-left transition-shadow hover:border-primary/60 active:cursor-grabbing ${dragging === deal.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{deal.name}</span>
                      {deal.amount ? (
                        <span className="text-xs font-semibold text-primary">
                          {money(deal.amount)}
                        </span>
                      ) : null}
                    </div>
                    {deal.request ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {deal.request}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {deal.managerId ? (
                        <span className="rounded bg-secondary px-1.5 py-0.5">
                          {nameById[deal.managerId] ?? "—"}
                        </span>
                      ) : null}
                      {deal.leadDate ? <span>{deal.leadDate}</span> : null}
                      {deal.paidAmount > 0 ? <span>Оплачено {money(deal.paidAmount)}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate(selected);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Имя">
                  <Input
                    value={selected.name}
                    onChange={(event) => setSelected({ ...selected, name: event.target.value })}
                  />
                </Field>
                <Field label="Статус">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={selected.status}
                    onChange={(event) =>
                      setSelected({ ...selected, status: event.target.value as LeadStatus })
                    }
                  >
                    {STATUS_COLUMNS.map((column) => (
                      <option
                        key={column.key}
                        value={column.key}
                        disabled={
                          column.key === "paid" &&
                          (selected.paidAmount <= 0 ||
                            selected.paidAmount < Number(selected.amount ?? 0))
                        }
                      >
                        {column.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Телефон">
                  <Input
                    value={selected.phone ?? ""}
                    onChange={(event) => setSelected({ ...selected, phone: event.target.value })}
                  />
                </Field>
                <Field label="Telegram">
                  <Input
                    value={selected.telegram ?? ""}
                    onChange={(event) => setSelected({ ...selected, telegram: event.target.value })}
                  />
                </Field>
                <Field label="Тариф">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={selected.productId ?? ""}
                    onChange={(event) =>
                      setSelected({ ...selected, productId: event.target.value || null })
                    }
                  >
                    <option value="">Не выбран</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Менеджер">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={selected.managerId ?? ""}
                    onChange={(event) =>
                      setSelected({ ...selected, managerId: event.target.value || null })
                    }
                    disabled={!me?.isAdmin}
                  >
                    <option value="">Не назначен</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Сумма, ₽">
                  <Input
                    type="number"
                    min="0"
                    value={selected.amount ?? ""}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        amount: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Чистыми, ₽">
                  <Input
                    type="number"
                    min="0"
                    value={selected.net ?? ""}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        net: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Запрос клиента">
                <Textarea
                  rows={2}
                  value={selected.request ?? ""}
                  onChange={(event) => setSelected({ ...selected, request: event.target.value })}
                />
              </Field>
              <Field label="Условия оплаты">
                <Input
                  value={selected.paymentTerms ?? ""}
                  onChange={(event) =>
                    setSelected({ ...selected, paymentTerms: event.target.value })
                  }
                />
              </Field>
              <Field label="Комментарий / причина отказа">
                <Textarea
                  rows={2}
                  value={selected.comment ?? ""}
                  onChange={(event) => setSelected({ ...selected, comment: event.target.value })}
                />
              </Field>
              <Field label="Следующий шаг">
                <Input
                  value={selected.nextAction ?? ""}
                  onChange={(event) => setSelected({ ...selected, nextAction: event.target.value })}
                />
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  Сохранить
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!paymentDraft} onOpenChange={(open) => !open && setPaymentDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Оплата · {paymentDraft?.deal.name}</DialogTitle>
          </DialogHeader>
          {paymentDraft ? (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                recordPayment.mutate(paymentDraft);
              }}
            >
              <div className="rounded-lg bg-secondary p-3 text-sm">
                Согласовано: {money(paymentDraft.deal.amount ?? 0)} · уже оплачено:{" "}
                {money(paymentDraft.deal.paidAmount)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Сумма платежа, ₽">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={paymentDraft.amount || ""}
                    onChange={(event) =>
                      setPaymentDraft({ ...paymentDraft, amount: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Чистыми, ₽">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentDraft.netAmount}
                    onChange={(event) =>
                      setPaymentDraft({ ...paymentDraft, netAmount: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Дата">
                  <Input
                    type="date"
                    required
                    value={paymentDraft.paidAt}
                    onChange={(event) =>
                      setPaymentDraft({ ...paymentDraft, paidAt: event.target.value })
                    }
                  />
                </Field>
                <Field label="Способ">
                  <Input
                    value={paymentDraft.method}
                    onChange={(event) =>
                      setPaymentDraft({ ...paymentDraft, method: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label="Комментарий">
                <Textarea
                  rows={2}
                  value={paymentDraft.note}
                  onChange={(event) =>
                    setPaymentDraft({ ...paymentDraft, note: event.target.value })
                  }
                />
              </Field>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={recordPayment.isPending || paymentDraft.amount <= 0}
                >
                  Записать и перевести в «Оплачено»
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
