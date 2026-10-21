import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Clock, FileText, Home, PackageCheck } from "lucide-react";
import { BRAND_NAME } from "@/config/brand";
import { portalMe } from "@/lib/portal.functions";
import { readPortalToken, usePortalSession } from "@/hooks/use-portal-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal")({
  ssr: false,
  beforeLoad: ({ location }) => {
    if (location.pathname !== "/portal/login" && location.pathname !== "/portal/login/" && !readPortalToken()) {
      throw redirect({ to: "/portal/login" });
    }
  },
  component: PortalLayout,
});

const TABS = [
  { to: "/portal", label: "Início", icon: Home, exact: true },
  { to: "/portal/ponto", label: "Ponto", icon: Clock },
  { to: "/portal/documentos", label: "Documentos", icon: FileText },
  { to: "/portal/itens", label: "EPIs", icon: PackageCheck },
] as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom turno";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function PortalLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname.startsWith("/portal/login");
  const { token } = usePortalSession();
  const me = useServerFn(portalMe);

  const { data } = useQuery({
    queryKey: ["portal-me", token],
    enabled: !!token && !isLogin,
    queryFn: () => me({ data: { token: token! } }),
  });

  const profile = data && !("error" in data) ? data : null;
  const fullName = profile?.employee?.name ?? "";
  const firstName = fullName.split(" ")[0] ?? "";
  const initials = fullName
    ? fullName
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : BRAND_NAME.slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-background">
      {isLogin ? (
        <main className="flex-1 px-5 py-6">
          <Outlet />
        </main>
      ) : (
        <>
          <header className="px-6 pt-7 pb-1">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Portal do colaborador
                </p>
                <h1 className="display-type mt-1 truncate text-xl">
                  {firstName ? `${greeting()}, ${firstName}` : BRAND_NAME}
                </h1>
              </div>
              <Link
                to="/portal/perfil"
                aria-label="Abrir meu perfil"
                className="portal-press relative grid size-12 shrink-0 place-items-center rounded-full border-2 border-foreground bg-card text-sm font-bold shadow-[3px_3px_0_var(--ink)]"
              >
                {initials}
                <span className="sr-only">Meu perfil</span>
                <Bell
                  className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-foreground bg-accent p-[1px]"
                  aria-hidden
                />
              </Link>
            </div>
          </header>

          <main className="flex-1 px-5 pt-5 pb-32">
            <Outlet />
          </main>

          <nav
            aria-label="Navegação do portal"
            className="fixed inset-x-0 bottom-3 z-30 mx-auto w-full max-w-lg px-3"
          >
            <ul className="flex h-16 items-center justify-around rounded-[24px] border-2 border-foreground bg-foreground px-2 shadow-[4px_4px_0_var(--ink)]">
              {TABS.map((tab) => {
                const active =
                  "exact" in tab && tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
                const Icon = tab.icon;
                return (
                  <li key={tab.to}>
                    <Link
                      to={tab.to}
                      aria-current={active ? "page" : undefined}
                      aria-label={tab.label}
                      className="flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 px-2"
                    >
                      <span
                        className={cn(
                          "grid size-10 place-items-center rounded-full transition-colors duration-200",
                          active
                            ? "border-2 border-background bg-accent text-accent-foreground"
                            : "text-background",
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-[0.08em]",
                          active ? "text-accent" : "text-background/70",
                        )}
                      >
                        {tab.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
