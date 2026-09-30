import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Вход — Финпланер CRM" },
      { name: "description", content: "Вход в CRM отдела продаж: заявки, оплаты, планы и премии." },
      { property: "og:title", content: "Вход — Финпланер CRM" },
      { property: "og:description", content: "Вход в CRM отдела продаж." },
    ],
  }),
  component: AuthPage,
});

const TEST_ACCOUNTS = [
  { label: "Вася — руководитель", email: "vasya@crm.test", password: "Krm-Vasya-2026!q" },
  { label: "Алина — менеджер", email: "alina@crm.test", password: "Krm-Alina-2026!q" },
  { label: "Паша — менеджер", email: "pasha@crm.test", password: "Krm-Pasha-2026!q" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(TEST_ACCOUNTS[0]!.email);
  const [password, setPassword] = useState(TEST_ACCOUNTS[0]!.password);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/board" });
    });
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Не удалось войти", { description: error.message });
      return;
    }
    navigate({ to: "/board" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-surface p-12 lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary font-semibold text-primary-foreground">
            Ф
          </span>
          <span className="font-display text-lg font-semibold">Финпланер CRM</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">
            Заявки, оплаты и премии — в одном окне
          </h1>
          <p className="mt-4 text-muted-foreground">
            Канбан по статусам сделок, автоматический перенос оплат, планы и коэффициенты по каждому
            менеджеру.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Доступ по ролям: руководитель и менеджер</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Вход в систему</h2>
          <p className="mt-1 text-sm text-muted-foreground">Выберите тестовый доступ или введите свой.</p>

          <div className="mt-5 grid gap-2">
            {TEST_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.password);
                }}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  email === acc.email
                    ? "border-primary bg-secondary"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <div className="font-medium">{acc.label}</div>
                <div className="text-xs text-muted-foreground">{acc.email}</div>
              </button>
            ))}
          </div>

          <form onSubmit={signIn} className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Почта</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Входим…" : "Войти"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
