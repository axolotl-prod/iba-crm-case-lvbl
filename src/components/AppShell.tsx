import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/board", label: "Доска" },
  { to: "/payments", label: "Оплаты" },
  { to: "/desk", label: "Рабочий стол" },
  { to: "/dashboard", label: "Планы", adminOnly: true },
  { to: "/team", label: "Сотрудники", adminOnly: true },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  fitViewport = false,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  fitViewport?: boolean;
}) {
  const { data: me, isPending } = useMe();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth" });
  };

  const queryClient = useQueryClient();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-5 py-3">
          <Link to="/board" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground font-semibold">
              Ф
            </span>
            <span className="font-display text-sm font-semibold tracking-tight">Финпланер CRM</span>
          </Link>
          <nav className={`flex flex-wrap items-center gap-1 transition-opacity ${isPending ? "pointer-events-none opacity-0" : ""}`}>
            {navItems
              .filter((item) => !("adminOnly" in item && item.adminOnly) || me?.isAdmin)
              .map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  {item.label}
                </Link>
              ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{isPending ? "Проверяем доступ…" : me?.employee?.name ?? me?.email}</div>
              <div className="text-xs text-muted-foreground">
                {me?.isAdmin ? "Руководитель" : "Менеджер"}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Выйти">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className={`mx-auto max-w-[1500px] px-5 py-6 ${fitViewport ? "lg:flex lg:h-[calc(100dvh-57px)] lg:flex-col lg:overflow-hidden" : ""}`}>
        <div className={`flex flex-wrap items-end justify-between gap-3 ${fitViewport ? "mb-4 shrink-0" : "mb-6"}`}>
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
        <div className={fitViewport ? "min-h-0 flex-1" : ""}>{children}</div>
      </main>
    </div>
  );
}
