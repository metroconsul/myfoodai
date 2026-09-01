import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyCompanyBranding } from "@/config/brand";
import { planFeatures, type FeatureCode } from "@/config/features";
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
  isPlatformAdmin: boolean;
  planCode: string;
  features: FeatureCode[];
  hasFeature: (code: FeatureCode) => boolean;
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
      if (!userId)
        return {
          userId: null,
          profile: null,
          company: null,
          units: [],
          roles: [],
          entitlements: [] as string[],
          isPlatformAdmin: false,
        };

      const [{ data: profile }, { data: roleRows }, { data: platformRow }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      ]);

      let company: Company | null = null;
      let units: Unit[] = [];
      let entitlements: string[] = [];
      if (profile?.company_id) {
        const [{ data: c }, { data: u }, { data: ents }] = await Promise.all([
          supabase.from("companies").select("*").eq("id", profile.company_id).maybeSingle(),
          supabase.from("units").select("*").order("name"),
          supabase
            .from("feature_entitlements")
            .select("feature_code, enabled")
            .eq("company_id", profile.company_id),
        ]);
        company = c ?? null;
        units = u ?? [];
        entitlements = (ents ?? []).filter((e) => e.enabled).map((e) => e.feature_code);
      }
      return {
        userId,
        profile: profile ?? null,
        company,
        units,
        roles: (roleRows ?? []).map((r) => r.role),
        entitlements,
        isPlatformAdmin: Boolean(platformRow),
      };
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
    const isPlatformAdmin = Boolean(data?.isPlatformAdmin);
    const planCode = data?.company?.plan_code ?? "comeco";
    const granted = data?.entitlements ?? [];
    const features: FeatureCode[] =
      granted.length > 0 ? (granted as FeatureCode[]) : planFeatures(planCode);
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
      isPlatformAdmin,
      planCode,
      features,
      hasFeature: (code: FeatureCode) => isPlatformAdmin || features.includes(code),
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
