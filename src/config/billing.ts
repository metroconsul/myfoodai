/**
 * Configuração de cobrança (Stripe).
 * A chave publicável pode ficar no código — ela é segura para o frontend.
 * A chave secreta fica apenas no servidor (STRIPE_LIVE_API_KEY).
 */

export const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51UAcLkRzTbFSBgbD8HVC6RZmMj84Efm1sFLrjl4UicRHRcqazQPdGBMMFm5KjUOvs3PO7EHDox6rplRE6aXZS2uA001YDA2unu";

export interface PlanPrice {
  /** Valor em centavos (BRL). */
  unitAmount: number;
  /** Nome exibido no checkout. */
  productName: string;
  /** Price ID cadastrado na Stripe. Quando presente, é usado no checkout. */
  priceId?: string;
}

/** Preços oficiais por plano e ciclo, em centavos. */
export const PLAN_PRICES: Record<
  string,
  { monthly: PlanPrice; yearly: PlanPrice }
> = {
  comeco: {
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

/** Price IDs aceitos pelo backend. O frontend nunca define preço. */
export const ALLOWED_PRICE_IDS = Object.values(PLAN_PRICES)
  .flatMap((p) => [p.monthly.priceId, p.yearly.priceId])
  .filter((id): id is string => Boolean(id));

/** Descobre plano e ciclo a partir de um Price ID da Stripe. */
export function planFromPriceId(
  priceId: string | null | undefined,
): { planId: string; cycle: "monthly" | "yearly" } | null {
  if (!priceId) return null;
  for (const [planId, prices] of Object.entries(PLAN_PRICES)) {
    if (prices.monthly.priceId === priceId) return { planId, cycle: "monthly" };
    if (prices.yearly.priceId === priceId) return { planId, cycle: "yearly" };
  }
  return null;
}
