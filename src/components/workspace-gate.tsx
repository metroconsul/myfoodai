import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { FeatureBlocked } from "@/components/feature-blocked";

/**
 * Portão comum a todas as áreas logadas da empresa (/painel e os aplicativos):
 * espera o workspace, leva ao onboarding quem ainda não tem empresa e bloqueia sem assinatura válida.
 * Deve ficar dentro de <WorkspaceProvider>.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { loading, company, hasSubscriptionAccess, planCode } = useWorkspace();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !company && pathname !== "/onboarding") {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, company, navigate, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div
          role="status"
          aria-live="polite"
          className="w-full max-w-sm rounded-[12px] border-2 border-foreground bg-card p-6 text-center shadow-[4px_4px_0_var(--ink)]"
        >
          <span className="display-type text-lg">Preparando o turno</span>
          <p className="meta-mono mt-2">Carregando sua operação…</p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full border-2 border-foreground bg-secondary">
            <div className="h-full w-1/2 animate-pulse bg-accent" />
          </div>
        </div>
      </div>
    );
  }

  if (!company) return null;

  if (!hasSubscriptionAccess) {
    return (
      <FeatureBlocked
        planCode={planCode}
        title="Assinatura necessária para acessar a operação"
        description="O acesso será liberado quando a assinatura da empresa estiver ativa. Fale com a MyFoods se precisar de ajuda."
      />
    );
  }

  return <>{children}</>;
}
