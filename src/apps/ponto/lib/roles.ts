import { useWorkspace } from "@/hooks/use-workspace";

/** Papéis do MyFoods Ponto (iguais ao registro de apps). A autorização de cada ação continua no banco. */
export const PONTO_ROLES = ["owner", "admin", "hr", "unit_manager", "supervisor"] as const;

export function usePontoRoles() {
  const { roles } = useWorkspace();
  const has = (list: readonly string[]) => roles.some((r) => list.includes(r));
  return {
    canUse: has(PONTO_ROLES),
    canConfigure: has(["owner", "admin", "hr"]),
  };
}
