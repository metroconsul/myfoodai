import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceGate } from "@/components/workspace-gate";
import { CfShell } from "@/apps/caixa-financeiro/components/cf-shell";
import { useCfRoles } from "@/apps/caixa-financeiro/lib/hooks";
import { Button } from "@/components/ui/button";
import { contactHref } from "@/config/brand";

/** MyFoods Caixa & Financeiro: layout, contratação e papel. A autorização de cada ação está no banco. */
export const Route = createFileRoute("/_authenticated/caixa-financeiro")({
  head: () => ({ meta: [{ title: "Caixa & Financeiro — Grupo MyFoods" }, { name: "robots", content: "noindex" }] }),
  component: CaixaFinanceiroLayout,
});

function CaixaFinanceiroLayout() {
  return (
    <WorkspaceProvider>
      <WorkspaceGate>
        <CfAccessGate />
      </WorkspaceGate>
    </WorkspaceProvider>
  );
}

function CfAccessGate() {
  const { features, isPlatformAdmin } = useWorkspace();
  const { canOperate, canFinance } = useCfRoles();
  // Contratação conferida na lista real de acessos (sem o atalho de administração da plataforma),
  // porque o banco só libera os dados para empresas com o app ativo.
  const contracted = features.includes("app_caixa_financeiro");

  if (!contracted) {
    return (
      <Blocked
        title="Aplicativo não contratado"
        text="O MyFoods Caixa & Financeiro não está ativo para a sua empresa."
        action={
          isPlatformAdmin ? (
            <Button asChild>
              <Link to="/painel/admin/aplicativos">Ativar na administração</Link>
            </Button>
          ) : (
            <Button asChild>
              <a href={contactHref("Olá! Quero contratar o MyFoods Caixa & Financeiro.")} target="_blank" rel="noopener noreferrer">
                Fale com a MyFoods
              </a>
            </Button>
          )
        }
      />
    );
  }
  if (!canOperate && !canFinance) {
    return (
      <Blocked
        title="Seu perfil não tem acesso"
        text="Peça ao administrador da empresa o papel de operador de caixa ou de financeiro."
      />
    );
  }
  return (
    <CfShell>
      <Outlet />
    </CfShell>
  );
}

function Blocked({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-[12px] border-2 border-foreground bg-card p-8 text-center shadow-[4px_4px_0_var(--ink)]">
        <h1 className="display-type text-xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {action}
          <Button asChild variant="outline">
            <Link to="/painel">Voltar aos aplicativos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
