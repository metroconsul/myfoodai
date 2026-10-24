import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyCompanyBranding } from "@/config/brand";
import { PLAN_APPS, planFeatures, type FeatureCode, type PlanCode } from "@/config/features";
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
  hasSubscriptionAccess: boolean;
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
    const hasSubscriptionAccess =
      isPlatformAdmin ||
      (data?.company?.access_source === "subscription" && ["active", "trialing"].includes(data.company.subscription_status)) ||
      (data?.company?.access_source === "admin_grant" && data.company.subscription_status === "admin_grant") ||
      (data?.company?.access_source === "trial" &&
        data.company.subscription_status === "trialing" &&
        Boolean(data.company.trial_ends_at && new Date(data.company.trial_ends_at) > new Date()));
    const granted = (data?.entitlements ?? []) as FeatureCode[];
    // Empresas sem linhas de acesso por aplicativo (banco ainda sem a migration 20261024165301)
    // recebem os apps padrão do plano, para que a ordem de deploy não bloqueie ninguém.
    const legacyApps = granted.some((code) => code.startsWith("app_"))
      ? []
      : (PLAN_APPS[planCode as PlanCode] ?? PLAN_APPS.comeco);
    const features: FeatureCode[] = hasSubscriptionAccess
      ? granted.length > 0
        ? [...granted, ...legacyApps]
        : planFeatures(planCode)
      : [];
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
      hasSubscriptionAccess,
      planCode,
      features,
      hasFeature: (code: FeatureCode) => hasSubscriptionAccess && (isPlatformAdmin || features.includes(code)),
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
