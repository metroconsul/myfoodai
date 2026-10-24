import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { WorkspaceProvider, useWorkspace } from "@/hooks/use-workspace";
import { AppShell } from "@/components/app-shell";
import { FeatureBlocked } from "@/components/feature-blocked";
import { WorkspaceGate } from "@/components/workspace-gate";
import { appForRoute, featureForRoute } from "@/config/features";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <WorkspaceProvider>
      <WorkspaceGate>
        <AppShell>
          <RouteFeatureGate pathname={pathname}>
            <Outlet />
          </RouteFeatureGate>
        </AppShell>
      </WorkspaceGate>
    </WorkspaceProvider>
  );
}

function RouteFeatureGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { hasFeature, planCode, isPlatformAdmin } = useWorkspace();

  if (pathname.startsWith("/app/admin") && !isPlatformAdmin) {
    return <FeatureBlocked planCode={planCode} title="Área exclusiva da administração" />;
  }

  const app = appForRoute(pathname);
  if (app && !hasFeature(app)) {
    return (
      <FeatureBlocked
        planCode={planCode}
        title="Aplicativo não contratado"
        description="Este aplicativo não está ativo para a sua empresa. Fale com a MyFoods para contratar."
      />
    );
  }

  const feature = featureForRoute(pathname);
  if (feature && !hasFeature(feature)) {
    return <FeatureBlocked planCode={planCode} />;
  }
  return <>{children}</>;
}
