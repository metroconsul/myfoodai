export type BillingInterval = "monthly" | "yearly";

export interface BillingPrice {
  priceId?: string;
  unitAmount: number;
  productName: string;
}

export interface BillingPlan {
  productId?: string;
  monthly: BillingPrice;
  yearly: BillingPrice;
}

/** Catálogo permitido pelo backend. Planos sem Price ID não abrem Checkout. */
export const PLAN_PRICES: Record<string, BillingPlan> = {
  comeco: {
    productId: "prod_VB0UQimCMeINc7",
    monthly: {
      unitAmount: 7990,
      productName: "MY FOOD'S AI — Começo (mensal)",
      priceId: "price_1UAeTjRzTbFSBgbDKHq91ZYH",
    },
    yearly: {
      unitAmount: 76704,
      productName: "MY FOOD'S AI — Começo (anual)",
      priceId: "price_1UAeTjRzTbFSBgbD2ASyogbe",
    },
  },
  essencial: {
    monthly: { unitAmount: 14990, productName: "MY FOOD'S AI — Essencial (mensal)" },
    yearly: { unitAmount: 143904, productName: "MY FOOD'S AI — Essencial (anual)" },
  },
  equipe: {
    monthly: { unitAmount: 24990, productName: "MY FOOD'S AI — Equipe (mensal)" },
    yearly: { unitAmount: 239904, productName: "MY FOOD'S AI — Equipe (anual)" },
  },
};

export function priceForPlan(planKey: string, interval: BillingInterval) {
  const plan = PLAN_PRICES[planKey];
  const price = plan?.[interval];
  if (!plan || !price?.priceId) throw new Error("Este plano ainda não está disponível para contratação.");
  return { ...price, priceId: price.priceId!, planKey, interval, productId: plan.productId ?? null };
}

export function planFromPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  for (const [planKey, plan] of Object.entries(PLAN_PRICES)) {
    for (const interval of ["monthly", "yearly"] as const) {
      if (plan[interval].priceId === priceId) return { planKey, interval, productId: plan.productId ?? null };
    }
  }
  return null;
}
