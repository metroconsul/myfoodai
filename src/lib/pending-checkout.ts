import { createCheckoutSession } from "@/lib/billing.functions";
import type { BillingCycle } from "@/config/plans";

const STORAGE_KEY = "pending_checkout";

export interface PendingCheckout {
  planId: "comeco" | "essencial" | "equipe";
  cycle: BillingCycle;
}

export function savePendingCheckout(pending: PendingCheckout) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    /* sessão indisponível */
  }
}

export function readPendingCheckout(): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCheckout;
    if (!["comeco", "essencial", "equipe"].includes(parsed.planId)) return null;
    if (!["monthly", "yearly"].includes(parsed.cycle)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sessão indisponível */
  }
}

/**
 * Se houver um plano pendente, cria a sessão de checkout da Stripe e
 * redireciona o navegador. Retorna true quando o redirecionamento começou.
 */
export async function resumePendingCheckout(): Promise<boolean> {
  const pending = readPendingCheckout();
  if (!pending) return false;
  clearPendingCheckout();
  const { url } = await createCheckoutSession({
    data: { ...pending, origin: window.location.origin },
  });
  window.location.href = url;
  return true;
}
