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
  // Acesso por aplicativo (migration 20261024120100). Os códigos acima valem dentro de cada app.
  "app_ponto",
  "app_documentos",
  "app_estoque",
  "app_compras",
  "app_caixa_financeiro",
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

/** Aplicativos padrão de cada plano — espelha `public.plan_app_codes` no banco. */
export const PLAN_APPS: Record<PlanCode, FeatureCode[]> = {
  comeco: ["app_ponto", "app_documentos"],
  essencial: ["app_ponto", "app_documentos", "app_estoque"],
  equipe: ["app_ponto", "app_documentos", "app_estoque"],
};

export const PLAN_FEATURES: Record<PlanCode, FeatureCode[]> = {
  comeco: [...COMECO_FEATURES, ...PLAN_APPS.comeco],
  essencial: [...ESSENCIAL_FEATURES, ...PLAN_APPS.essencial],
  equipe: [...EQUIPE_FEATURES, ...PLAN_APPS.equipe],
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

/**
 * Rota legada /app → aplicativo a que pertence. Enquanto as telas não mudam de endereço (etapa F2),
 * o app desligado para a empresa também bloqueia estas rotas. Itens (/app/items) são compartilhados
 * entre Estoque e Documentos (EPIs) e por isso não exigem um app específico.
 */
export const ROUTE_APPS: { prefix: string; app: FeatureCode }[] = [
  { prefix: "/app/time-entries", app: "app_ponto" },
  { prefix: "/app/point-cards", app: "app_ponto" },
  { prefix: "/app/schedule-templates", app: "app_ponto" },
  { prefix: "/app/schedule-compliance", app: "app_ponto" },
  { prefix: "/app/schedule-history", app: "app_ponto" },
  { prefix: "/app/schedules", app: "app_ponto" },
  { prefix: "/app/shifts", app: "app_ponto" },
  { prefix: "/app/settings/jornada", app: "app_ponto" },
  { prefix: "/app/conformidade", app: "app_documentos" },
  { prefix: "/app/documentos", app: "app_documentos" },
  { prefix: "/app/deliveries", app: "app_documentos" },
  { prefix: "/app/delivery-rules", app: "app_documentos" },
  { prefix: "/app/inventory", app: "app_estoque" },
];

export function appForRoute(pathname: string): FeatureCode | null {
  const match = ROUTE_APPS.find((r) => pathname.startsWith(r.prefix));
  return match?.app ?? null;
}
