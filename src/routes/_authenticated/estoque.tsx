import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceGate } from "@/components/workspace-gate";
import { EstoqueShell } from "@/apps/estoque/components/estoque-shell";
import { useEstoqueRoles } from "@/apps/estoque/lib/roles";
import { Button } from "@/components/ui/button";
import { contactHref } from "@/config/brand";

/** MyFoods Estoque: layout, contratação e papel. A autorização de cada ação está no banco. */
export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Grupo MyFoods" }, { name: "robots", content: "noindex" }] }),
  component: EstoqueLayout,
});

function EstoqueLayout() {
  return (
    <WorkspaceProvider>
      <WorkspaceGate>
        <EstoqueAccessGate />
      </WorkspaceGate>
    </WorkspaceProvider>
  );
}

function EstoqueAccessGate() {
  const { hasFeature, isPlatformAdmin } = useWorkspace();
  const { canUse } = useEstoqueRoles();

  if (!hasFeature("app_estoque")) {
    return (
      <Blocked
        title="Aplicativo não contratado"
        text="O MyFoods Estoque não está ativo para a sua empresa."
        action={
          <Button asChild>
            <a href={contactHref("Olá! Quero contratar o MyFoods Estoque.")} target="_blank" rel="noopener noreferrer">
              Fale com a MyFoods
            </a>
          </Button>
        }
      />
    );
  }
  if (!canUse && !isPlatformAdmin) {
    return <Blocked title="Seu perfil não tem acesso" text="Peça ao administrador da empresa o papel de estoquista ou gerente." />;
  }
  return (
    <EstoqueShell>
      <Outlet />
    </EstoqueShell>
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
