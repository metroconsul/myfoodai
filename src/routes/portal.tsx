import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Clock, FileText, Home, User } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal")({
  ssr: false,
  component: PortalLayout,
});

const TABS = [
  { to: "/portal", label: "Início", icon: Home, exact: true },
  { to: "/portal/escala", label: "Escala", icon: CalendarDays },
  { to: "/portal/ponto", label: "Ponto", icon: Clock },
  { to: "/portal/cartao-ponto", label: "Cartão", icon: FileText },
  { to: "/portal/perfil", label: "Perfil", icon: User },
] as const;

function PortalLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname.startsWith("/portal/login");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x-2 border-foreground bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b-2 border-foreground bg-card px-4">
        <span className="flex size-8 items-center justify-center rounded-[8px] border-2 border-foreground bg-accent text-sm font-bold shadow-[2px_2px_0_var(--ink)]">
          {BRAND_NAME.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="display-type truncate text-xs uppercase">{BRAND_NAME}</p>
          <p className="meta-mono truncate">Portal do colaborador</p>
        </div>
      </header>

      <main className={cn("flex-1 px-4 py-5", !isLogin && "pb-28")}>
        <Outlet />
      </main>

      {!isLogin ? (
        <nav
          className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md justify-between gap-1 border-t-2 border-foreground bg-card px-2 py-2"
          aria-label="Navegação do portal"
        >
          {TABS.map((tab) => {
            const active = "exact" in tab && tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-[8px] border-2 py-1.5 text-[11px] font-semibold transition-colors",
                  active
                    ? "border-foreground bg-accent text-accent-foreground shadow-[2px_2px_0_var(--ink)]"
                    : "border-transparent text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
