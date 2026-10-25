import { Outlet } from "@tanstack/react-router";
import { useWorkspace } from "@/hooks/use-workspace";
import { SubNav } from "./ponto-shell";

export function EquipeLayout() {
  const { hasFeature } = useWorkspace();
  return (
    <>
      <SubNav
        label="Equipe"
        items={[
          { to: "/ponto/equipe", label: "Colaboradores", show: hasFeature("employees") },
          { to: "/ponto/equipe/cargos", label: "Cargos e equipes", show: hasFeature("roles_teams") },
        ]}
      />
      <Outlet />
    </>
  );
}
