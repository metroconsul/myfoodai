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
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          {BRAND_NAME.slice(0, 1).toUpperCase()}
        </span>
        <span className="font-semibold">Portal do colaborador</span>
      </header>

      <main className={cn("flex-1 px-4 py-5", !isLogin && "pb-24")}>
        <Outlet />
      </main>

      {!isLogin ? (
        <nav
          className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md justify-between border-t border-border bg-card px-2 py-2"
          aria-label="Navegação do portal"
        >
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] transition-colors",
                  active ? "text-primary font-medium" : "text-muted-foreground",
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
