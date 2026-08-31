import { useQuery } from "@tanstack/react-query";
import { portalPolicies } from "@/lib/policies.functions";
import { readPortalToken } from "./use-portal-session";
import {
  DEFAULT_ACCEPTANCE_POLICY,
  DEFAULT_PRIVACY_POLICY,
  type AcceptancePolicy,
  type PrivacyPolicy,
} from "@/lib/policies.shared";

/** Políticas de aceite e privacidade da empresa aplicadas ao Portal. */
export function usePortalPolicies() {
  const token = typeof window === "undefined" ? null : readPortalToken();
  const query = useQuery({
    queryKey: ["portal-policies", token],
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await portalPolicies({ data: { token: token! } });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
  });

  const acceptance: AcceptancePolicy = query.data?.acceptance ?? DEFAULT_ACCEPTANCE_POLICY;
  const privacy: PrivacyPolicy = query.data?.privacy ?? DEFAULT_PRIVACY_POLICY;
  return { acceptance, privacy, loading: query.isLoading };
}
