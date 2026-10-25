import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND_LOGO } from "@/config/brand";
import { cn } from "@/lib/utils";

type Tab = { to: string; label: string; exact?: boolean; show: boolean };

/** Estrutura do MyFoods Compras: cabeçalho próprio, unidade ativa, 4 abas e engrenagem (fornecedores). Sem itens de outros apps. */
export function ComprasShell({ children }: { children: ReactNode }) {
  const { company, units, activeUnitId, setActiveUnitId } = useWorkspace();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tabs: Tab[] = [
    { to: "/compras", label: "Visão geral", exact: true, show: true },
    { to: "/compras/pedidos", label: "Pedidos", show: true },
    { to: "/compras/receber", label: "Receber", show: true },
    { to: "/compras/historico", label: "Histórico", show: true },
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
            <p className="display-type truncate text-sm uppercase leading-none">MyFoods Compras</p>
            <p className="meta-mono truncate">{company?.name ?? ""}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {units.length > 1 ? (
              <Select value={activeUnitId ?? ""} onValueChange={setActiveUnitId}>
                <SelectTrigger className="w-40" aria-label="Unidade ativa">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button asChild variant={pathname === "/compras/fornecedores" ? "secondary" : "ghost"} size="icon">
              <Link to="/compras/fornecedores" aria-label="Fornecedores" title="Fornecedores">
                <Settings className="size-4" aria-hidden />
              </Link>
            </Button>
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
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2" aria-label="MyFoods Compras">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <TabLink key={t.to} to={t.to} active={t.exact ? pathname === t.to : pathname.startsWith(t.to)}>
                {t.label}
              </TabLink>
            ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}

function TabLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "whitespace-nowrap rounded-[8px] border-2 px-3 py-1.5 text-sm font-semibold",
        active ? "border-foreground bg-accent shadow-[2px_2px_0_var(--ink)]" : "border-transparent hover:border-foreground",
      )}
    >
      {children}
    </Link>
  );
}
