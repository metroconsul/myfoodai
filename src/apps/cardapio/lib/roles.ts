import { useWorkspace } from "@/hooks/use-workspace";

/** Cardápio Digital: qualquer funcionário com login acompanha pedidos e mesas; dono/admin/gerente montam o cardápio. */
export function useCardapioRoles() {
  const { roles } = useWorkspace();
  return {
    canUse: roles.length > 0,
    canManage: roles.some((r) => ["owner", "admin", "unit_manager"].includes(r)),
  };
}
