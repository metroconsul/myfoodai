import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND_LOGO } from "@/config/brand";
import { useComprasRoles } from "../lib/roles";

/** Estrutura do MyFoods Compras: cabeçalho próprio, loja ativa e engrenagem (quem faz as compras, só gestão). Sem abas. */
export function ComprasShell({ children }: { children: ReactNode }) {
  const { company, units, activeUnitId, setActiveUnitId } = useWorkspace();
  const { canManage } = useComprasRoles();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();


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
            {canManage ? (
              <Button asChild variant={pathname === "/compras/comprador" ? "secondary" : "ghost"} size="icon">
                <Link to="/compras/comprador" aria-label="Quem faz as compras" title="Quem faz as compras">
                  <Settings className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : null}
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
      </header>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
