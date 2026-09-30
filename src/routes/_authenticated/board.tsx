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

type Lead = {
  id: string;
  lead_date: string | null;
  name: string;
  phone: string | null;
  telegram: string | null;
  income: string | null;
  request: string | null;
  status: LeadStatus;
  raw_status: string | null;
  tariff: string | null;
  amount: number | null;
  net: number | null;
  payment_method: string | null;
  payment_date: string | null;
  comment: string | null;
  next_action: string | null;
  manager_id: string | null;
};

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "Канбан заявок — Финпланер CRM" },
      { name: "description", content: "Доска заявок по статусам сделок с перетаскиванием карточек." },
      { property: "og:title", content: "Канбан заявок — Финпланер CRM" },
      { property: "og:description", content: "Доска заявок по статусам сделок." },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("lead_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Lead[];
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

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      if (v.status === "paid") toast.success("Заявка перенесена в оплаты");
    },
    onError: (e: Error) => toast.error("Не удалось обновить статус", { description: e.message }),
  });

  const save = useMutation({
    mutationFn: async (lead: Lead) => {
      const { id, ...rest } = lead;
      const { error } = await supabase.from("leads").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      setSelected(null);
      toast.success("Заявка сохранена");
    },
    onError: (e: Error) => toast.error("Не удалось сохранить", { description: e.message }),
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<Lead>) => {
      const { error } = await supabase
        .from("leads")
        .insert({ ...payload, manager_id: me?.employee?.id ?? null, source: "crm" } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      setCreateOpen(false);
      toast.success("Заявка добавлена");
    },
    onError: (e: Error) => toast.error("Не удалось добавить", { description: e.message }),
  });

  const totalInWork = leads.filter((l) => ["new", "in_work", "kp_sent"].includes(l.status)).length;

  return (
    <AppShell
      title="Канбан заявок"
      subtitle={
        isLoading
          ? "Загружаем заявки…"
          : `${leads.length} заявок · ${totalInWork} в работе${me?.isAdmin ? " · режим руководителя" : ""}`
      }
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Новая заявка
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новая заявка</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                create.mutate({
                  name: String(f.get("name") || "Без имени"),
                  phone: (f.get("phone") as string) || null,
                  telegram: (f.get("telegram") as string) || null,
                  income: (f.get("income") as string) || null,
                  request: (f.get("request") as string) || null,
                  lead_date: new Date().toISOString().slice(0, 10),
                  status: "new",
                });
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="name">Имя клиента</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="telegram">Telegram</Label>
                  <Input id="telegram" name="telegram" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="income">Доход</Label>
                <Input id="income" name="income" placeholder="100.000-200.000 руб./мес" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="request">Запрос</Label>
                <Textarea id="request" name="request" rows={3} />
              </div>
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
      <div className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
        {STATUS_COLUMNS.map((col) => {
          const items = leads.filter((l) => l.status === col.key);
          const sum = items.reduce((acc, l) => acc + Number(l.amount ?? 0), 0);
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((c) => (c === col.key ? null : c))}
              onDrop={() => {
                setOver(null);
                if (dragging) move.mutate({ id: dragging, status: col.key });
                setDragging(null);
              }}
              className={`panel flex min-h-[320px] flex-col p-3 transition-colors ${
                over === col.key ? "border-primary bg-surface-2" : ""
              }`}
            >
              <header className="mb-3 px-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{col.title}</h2>
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {sum > 0 ? money(sum) : col.hint}
                </p>
              </header>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {items.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => setSelected(lead)}
                    className={`cursor-grab rounded-lg border border-border bg-card p-3 text-left transition-shadow hover:border-primary/60 active:cursor-grabbing ${
                      dragging === lead.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{lead.name}</span>
                      {lead.amount ? (
                        <span className="text-xs font-semibold text-primary">
                          {money(lead.amount)}
                        </span>
                      ) : null}
                    </div>
                    {lead.request ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {lead.request}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {lead.manager_id ? (
                        <span className="rounded bg-secondary px-1.5 py-0.5">
                          {nameById[lead.manager_id] ?? "—"}
                        </span>
                      ) : null}
                      {lead.lead_date ? <span>{lead.lead_date}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(selected);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Имя">
                  <Input
                    value={selected.name}
                    onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  />
                </Field>
                <Field label="Статус">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={selected.status}
                    onChange={(e) =>
                      setSelected({ ...selected, status: e.target.value as LeadStatus })
                    }
                  >
                    {STATUS_COLUMNS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Телефон">
                  <Input
                    value={selected.phone ?? ""}
                    onChange={(e) => setSelected({ ...selected, phone: e.target.value })}
                  />
                </Field>
                <Field label="Telegram">
                  <Input
                    value={selected.telegram ?? ""}
                    onChange={(e) => setSelected({ ...selected, telegram: e.target.value })}
                  />
                </Field>
                <Field label="Тариф">
                  <Input
                    value={selected.tariff ?? ""}
                    onChange={(e) => setSelected({ ...selected, tariff: e.target.value })}
                  />
                </Field>
                <Field label="Сумма, ₽">
                  <Input
                    type="number"
                    value={selected.amount ?? ""}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        amount: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Чистыми, ₽">
                  <Input
                    type="number"
                    value={selected.net ?? ""}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        net: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Способ оплаты">
                  <Input
                    value={selected.payment_method ?? ""}
                    onChange={(e) => setSelected({ ...selected, payment_method: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Запрос клиента">
                <Textarea
                  rows={2}
                  value={selected.request ?? ""}
                  onChange={(e) => setSelected({ ...selected, request: e.target.value })}
                />
              </Field>
              <Field label="Комментарий">
                <Textarea
                  rows={2}
                  value={selected.comment ?? ""}
                  onChange={(e) => setSelected({ ...selected, comment: e.target.value })}
                />
              </Field>
              <Field label="Следующий шаг">
                <Input
                  value={selected.next_action ?? ""}
                  onChange={(e) => setSelected({ ...selected, next_action: e.target.value })}
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
