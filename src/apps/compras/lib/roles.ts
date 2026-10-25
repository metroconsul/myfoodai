import { useWorkspace } from "@/hooks/use-workspace";

/** Papéis do MyFoods Compras (iguais ao registro de apps). Cada ação continua protegida no banco. */
export const COMPRAS_ROLES = ["owner", "admin", "unit_manager", "stock_manager"] as const;

export function useComprasRoles() {
  const { roles } = useWorkspace();
  return { canUse: roles.some((r) => (COMPRAS_ROLES as readonly string[]).includes(r)) };
}
