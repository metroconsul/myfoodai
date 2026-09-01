/**
 * Matriz de recursos por plano.
 *
 * `feature_code` é a mesma chave usada na tabela `feature_entitlements` e nas
 * validações de servidor (`requireFeature`). O frontend usa esta matriz apenas
 * para desenhar o menu — a autorização real acontece no banco e nas server
 * functions.
 */

export const FEATURES = [
  "dashboard",
  "employees",
  "roles_teams",
  "units",
  "multi_unit",
  "schedules_advanced",
  "shifts",
  "schedule_templates",
  "schedule_compliance",
  "schedule_history",
  "fixed_schedule",
  "time_entries",
  "point_cards",
  "items",
  "deliveries",
  "delivery_rules",
  "compliance",
  "payslips",
  "inventory",
  "sales",
  "settings",
  "billing",
] as const;

export type FeatureCode = (typeof FEATURES)[number];

export type PlanCode = "comeco" | "essencial" | "equipe";

/** Recursos do Plano Começo: operação enxuta, uma unidade, jornada fixa. */
export const COMECO_FEATURES: FeatureCode[] = [
  "dashboard",
  "employees",
  "roles_teams",
  "units",
  "fixed_schedule",
  "time_entries",
  "point_cards",
  "items",
  "deliveries",
  "compliance",
  "payslips",
  "settings",
  "billing",
];

export const ESSENCIAL_FEATURES: FeatureCode[] = [
  ...COMECO_FEATURES,
  "schedules_advanced",
  "shifts",
  "schedule_templates",
  "schedule_compliance",
  "schedule_history",
  "delivery_rules",
  "inventory",
];

export const EQUIPE_FEATURES: FeatureCode[] = [
  ...ESSENCIAL_FEATURES,
  "multi_unit",
  "sales",
];

export const PLAN_FEATURES: Record<PlanCode, FeatureCode[]> = {
  comeco: COMECO_FEATURES,
  essencial: ESSENCIAL_FEATURES,
  equipe: EQUIPE_FEATURES,
};

export const PLAN_LABELS: Record<PlanCode, string> = {
  comeco: "Plano Começo",
  essencial: "Plano Essencial",
  equipe: "Plano Equipe",
};

export function planFeatures(planCode: string | null | undefined): FeatureCode[] {
  const plan = (planCode ?? "comeco") as PlanCode;
  return PLAN_FEATURES[plan] ?? COMECO_FEATURES;
}

/** Rota → recurso necessário. Rotas ausentes são consideradas liberadas. */
export const ROUTE_FEATURES: { prefix: string; feature: FeatureCode }[] = [
  { prefix: "/app/schedule-templates", feature: "schedule_templates" },
  { prefix: "/app/schedule-compliance", feature: "schedule_compliance" },
  { prefix: "/app/schedule-history", feature: "schedule_history" },
  { prefix: "/app/schedules", feature: "schedules_advanced" },
  { prefix: "/app/shifts", feature: "shifts" },
  { prefix: "/app/delivery-rules", feature: "delivery_rules" },
  { prefix: "/app/inventory", feature: "inventory" },
  { prefix: "/app/sales", feature: "sales" },
  { prefix: "/app/conformidade", feature: "compliance" },
  { prefix: "/app/documentos", feature: "payslips" },
  { prefix: "/app/items", feature: "items" },
  { prefix: "/app/deliveries", feature: "deliveries" },
];

export function featureForRoute(pathname: string): FeatureCode | null {
  const match = ROUTE_FEATURES.find((r) => pathname.startsWith(r.prefix));
  return match?.feature ?? null;
}
