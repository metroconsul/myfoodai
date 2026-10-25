import type { ReactNode } from "react";
import { FeatureBlocked } from "@/components/feature-blocked";
import { useWorkspace } from "@/hooks/use-workspace";
import type { FeatureCode } from "@/config/features";

/** Mesmo bloqueio por plano que /app aplicava por rota (ROUTE_FEATURES), agora dentro do app Ponto. */
export function FeatureGuard({ feature, children }: { feature: FeatureCode; children: ReactNode }) {
  const { hasFeature, planCode } = useWorkspace();
  return hasFeature(feature) ? <>{children}</> : <FeatureBlocked planCode={planCode} />;
}
