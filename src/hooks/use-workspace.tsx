import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyCompanyBranding } from "@/config/brand";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies">;
type Unit = Tables<"units">;
type Profile = Tables<"profiles">;

interface WorkspaceValue {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  company: Company | null;
  units: Unit[];
  activeUnit: Unit | null;
  activeUnitId: string | null;
  setActiveUnitId: (id: string) => void;
  roles: string[];
  isAdmin: boolean;
  refresh: () => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeUnitId, setActiveUnitIdState] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;
      if (!userId) return { userId: null, profile: null, company: null, units: [], roles: [] };

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);

      let company: Company | null = null;
      let units: Unit[] = [];
      if (profile?.company_id) {
        const [{ data: c }, { data: u }] = await Promise.all([
          supabase.from("companies").select("*").eq("id", profile.company_id).maybeSingle(),
          supabase.from("units").select("*").order("name"),
        ]);
        company = c ?? null;
        units = u ?? [];
      }
      return { userId, profile: profile ?? null, company, units, roles: (roleRows ?? []).map((r) => r.role) };
    },
  });

  useEffect(() => {
    if (!data) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("active_unit_id") : null;
    const valid = data.units.find((u) => u.id === stored) ?? data.units[0] ?? null;
    setActiveUnitIdState(valid?.id ?? null);
  }, [data]);

  useEffect(() => {
    applyCompanyBranding(data?.company?.primary_color, data?.company?.accent_color);
  }, [data?.company?.primary_color, data?.company?.accent_color]);

  const value = useMemo<WorkspaceValue>(() => {
    const units = data?.units ?? [];
    const roles = data?.roles ?? [];
    return {
      loading: isLoading,
      userId: data?.userId ?? null,
      profile: data?.profile ?? null,
      company: data?.company ?? null,
      units,
      activeUnitId,
      activeUnit: units.find((u) => u.id === activeUnitId) ?? null,
      setActiveUnitId: (id: string) => {
        setActiveUnitIdState(id);
        window.localStorage.setItem("active_unit_id", id);
      },
      roles,
      isAdmin: roles.includes("owner") || roles.includes("admin"),
      refresh: () => queryClient.invalidateQueries({ queryKey: ["workspace"] }),
    };
  }, [data, isLoading, activeUnitId, queryClient]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace deve ser usado dentro de WorkspaceProvider");
  return ctx;
}
