import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <WorkspaceProvider>
      <WorkspaceGate />
    </WorkspaceProvider>
  );
}

function WorkspaceGate() {
  const { loading, company } = useWorkspace();
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

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
