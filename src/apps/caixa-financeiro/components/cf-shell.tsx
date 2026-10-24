import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BRAND_LOGO } from "@/config/brand";
import { cn } from "@/lib/utils";
import { useCfRoles } from "../lib/hooks";

type Tab = { to: string; label: string; exact?: boolean; show: boolean };

/** Estrutura do MyFoods Caixa & Financeiro: cabeçalho próprio e abas Caixa | Financeiro. */
export function CfShell({ children }: { children: ReactNode }) {
  const { company } = useWorkspace();
  const { canOperate, canFinance } = useCfRoles();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tabs: Tab[] = [
    { to: "/caixa-financeiro", label: "Visão geral", exact: true, show: true },
    { to: "/caixa-financeiro/caixa", label: "Caixa", show: canOperate || canFinance },
    { to: "/caixa-financeiro/vendas", label: "Vendas", show: canOperate || canFinance },
    { to: "/caixa-financeiro/configuracoes", label: "Configurações", show: canFinance },
  ];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b-2 border-foreground bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/painel" className="flex items-center gap-2" aria-label="Central de aplicativos">
            <img src={BRAND_LOGO} alt="" className="size-10 object-contain" />
          </Link>
          <div className="min-w-0">
            <p className="display-type truncate text-sm uppercase leading-none">MyFoods Caixa &amp; Financeiro</p>
            <p className="meta-mono truncate">{company?.name ?? ""}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/painel">
                <LayoutGrid className="mr-2 size-4" aria-hidden /> Aplicativos
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 size-4" aria-hidden /> Sair
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Caixa & Financeiro">
          {tabs
            .filter((t) => t.show)
            .map((t) => {
              const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap rounded-[8px] border-2 px-3 py-1.5 text-sm font-semibold",
                    active
                      ? "border-foreground bg-accent shadow-[2px_2px_0_var(--ink)]"
                      : "border-transparent hover:border-foreground",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
