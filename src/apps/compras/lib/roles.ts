import { useWorkspace } from "@/hooks/use-workspace";

/**
 * MyFoods Compras (listas): qualquer funcionário com login usa; dono, admin e gerente também apagam listas
 * e definem quem faz as compras. Cada ação continua protegida no banco.
 */
export function useComprasRoles() {
  const { roles } = useWorkspace();
  return {
    canUse: roles.length > 0,
    canManage: roles.some((r) => ["owner", "admin", "unit_manager"].includes(r)),
  };
}
