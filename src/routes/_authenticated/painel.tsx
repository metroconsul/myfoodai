import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceGate } from "@/components/workspace-gate";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_LOGO, GROUP_NAME } from "@/config/brand";

/** Central do cliente: área logada comum a todos os aplicativos da empresa. */
export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelLayout,
});

function PainelLayout() {
  return (
    <WorkspaceProvider>
      <WorkspaceGate>
        <PainelShell>
          <Outlet />
        </PainelShell>
      </WorkspaceGate>
    </WorkspaceProvider>
  );
}

function PainelShell({ children }: { children: React.ReactNode }) {
  const { company, isPlatformAdmin } = useWorkspace();
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
            <span className="hidden sm:block">
              <span className="display-type block text-sm uppercase leading-none">{GROUP_NAME}</span>
              <span className="meta-mono block truncate">{company?.name ?? ""}</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-2" aria-label="Central">
            {isPlatformAdmin ? (
              <Button asChild variant="ghost" size="sm">
                <Link to="/painel/admin/aplicativos">Administração</Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 size-4" aria-hidden />
              Sair
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
