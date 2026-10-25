import { useWorkspace } from "@/hooks/use-workspace";

/** Papéis do MyFoods Estoque (iguais ao registro de apps). Cada ação continua protegida no banco. */
export const ESTOQUE_ROLES = ["owner", "admin", "unit_manager", "stock_manager"] as const;

export function useEstoqueRoles() {
  const { roles } = useWorkspace();
  return { canUse: roles.some((r) => (ESTOQUE_ROLES as readonly string[]).includes(r)) };
}
