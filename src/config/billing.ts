/**
 * Configuração de cobrança (Stripe).
 * A chave publicável pode ficar no código — ela é segura para o frontend.
 * A chave secreta fica apenas no servidor (STRIPE_TEST_API_KEY / STRIPE_API_KEY).
 */

export const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51UAcMARxTOStc6pHpeiJjvKiT9AdQTWZUKDZRIhBvlxi3eIsvoUagK3B2iVum32dpy46ouwlW8t5FIv6XM1YQiqc00BKebZQrk";

export interface PlanPrice {
  /** Valor em centavos (BRL). */
  unitAmount: number;
  /** Nome exibido no checkout. */
  productName: string;
}

/** Preços oficiais por plano e ciclo, em centavos. */
export const PLAN_PRICES: Record<
  string,
  { monthly: PlanPrice; yearly: PlanPrice }
> = {
  comeco: {
    monthly: { unitAmount: 7990, productName: "Golden Hour Hub — Começo (mensal)" },
    yearly: { unitAmount: 76704, productName: "Golden Hour Hub — Começo (anual)" },
  },
  essencial: {
    monthly: { unitAmount: 14990, productName: "Golden Hour Hub — Essencial (mensal)" },
    yearly: { unitAmount: 143904, productName: "Golden Hour Hub — Essencial (anual)" },
  },
  equipe: {
    monthly: { unitAmount: 24990, productName: "Golden Hour Hub — Equipe (mensal)" },
    yearly: { unitAmount: 239904, productName: "Golden Hour Hub — Equipe (anual)" },
  },
};
