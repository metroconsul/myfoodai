/**
 * Mercado Pago (somente leitura de vendas): regras puras, sem rede nem banco.
 * Usadas pelo servidor e cobertas por testes unitários.
 */

export const MP_PROVIDER = "mercado_pago";
export const MP_AUTH_URL = "https://auth.mercadopago.com/authorization";
export const MP_API = "https://api.mercadopago.com";

/** Renova o token quando faltar menos que isso para vencer (o token dura 180 dias). */
export const MP_REFRESH_BEFORE_MS = 30 * 24 * 3600 * 1000;

/** Campos do pagamento que usamos (resposta de /v1/payments). */
export type MpPayment = {
  id: number | string;
  status: string;
  transaction_amount?: number | null;
  transaction_amount_refunded?: number | null;
  date_approved?: string | null;
  date_created?: string | null;
  payment_type_id?: string | null;
  payment_method_id?: string | null;
  transaction_details?: { net_received_amount?: number | null } | null;
};

export type MpOrderRow = {
  external_id: string;
  channel: string;
  ordered_at: string;
  gross_amount: number;
  net_amount: number | null;
  is_cancelled: boolean;
};

const KEEP_STATUS = new Set(["approved", "refunded", "charged_back"]);

/** Nome do canal mostrado em Vendas. */
export function mpChannel(p: Pick<MpPayment, "payment_type_id" | "payment_method_id">): string {
  if (p.payment_method_id === "pix") return "Mercado Pago · Pix";
  switch (p.payment_type_id) {
    case "credit_card":
      return "Mercado Pago · Crédito";
    case "debit_card":
      return "Mercado Pago · Débito";
    case "prepaid_card":
      return "Mercado Pago · Pré-pago";
    case "account_money":
      return "Mercado Pago · Saldo";
    case "ticket":
      return "Mercado Pago · Boleto";
    case "bank_transfer":
      return "Mercado Pago · Transferência";
    default:
      return "Mercado Pago";
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pagamento → venda. Só entram pagamentos que chegaram a ser aprovados;
 * estornados e contestados entram como cancelados. Pendentes e recusados ficam de fora (null).
 */
export function mapPaymentToOrder(p: MpPayment): MpOrderRow | null {
  if (!KEEP_STATUS.has(p.status)) return null;
  const when = p.date_approved ?? p.date_created;
  if (!when || p.transaction_amount == null) return null;
  const net = p.transaction_details?.net_received_amount;
  return {
    external_id: String(p.id),
    channel: mpChannel(p),
    ordered_at: new Date(when).toISOString(),
    gross_amount: round2(Number(p.transaction_amount)),
    net_amount: net == null ? null : round2(Number(net)),
    is_cancelled: p.status !== "approved",
  };
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Texto aleatório seguro em base64url (state e code_verifier). */
export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** code_challenge S256 do PKCE. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function buildAuthorizeUrl(o: { clientId: string; redirectUri: string; state: string; challenge: string }) {
  const u = new URL(MP_AUTH_URL);
  u.searchParams.set("client_id", o.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("platform_id", "mp");
  u.searchParams.set("state", o.state);
  u.searchParams.set("redirect_uri", o.redirectUri);
  u.searchParams.set("code_challenge", o.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

/** Lê o cabeçalho x-signature ("ts=...,v1=..."). */
export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, ...v] = kv.split("=");
      return [k?.trim() ?? "", v.join("=").trim()];
    }),
  );
  return parts["ts"] && parts["v1"] ? { ts: parts["ts"], v1: parts["v1"] } : null;
}

/** Texto assinado pelo Mercado Pago. Partes ausentes são omitidas, como na documentação. */
export function signatureManifest(o: { dataId: string | null; requestId: string | null; ts: string }) {
  let m = "";
  if (o.dataId) m += `id:${/^[a-z0-9]+$/i.test(o.dataId) ? o.dataId.toLowerCase() : o.dataId};`;
  if (o.requestId) m += `request-id:${o.requestId};`;
  m += `ts:${o.ts};`;
  return m;
}
