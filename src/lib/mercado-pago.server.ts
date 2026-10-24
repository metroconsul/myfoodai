import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MpDatabase } from "./mercado-pago.db";
import { appUrl } from "./stripe.server";
import {
  MP_API,
  MP_PROVIDER,
  MP_REFRESH_BEFORE_MS,
  mapPaymentToOrder,
  parseSignatureHeader,
  signatureManifest,
  type MpPayment,
} from "./mercado-pago.shared";

/**
 * Mercado Pago no servidor: tokens criptografados, troca/renovação de token e sincronização de vendas.
 * Tokens nunca saem do servidor nem vão para logs. Só leitura: nenhuma chamada cria, cobra ou estorna.
 */

/** Mesmo cliente service_role, tipado com as tabelas novas (tokens e estado do OAuth). */
export const mpAdmin = supabaseAdmin as unknown as SupabaseClient<MpDatabase>;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não configurada no servidor.`);
  return v;
}

export function mpRedirectUri() {
  return process.env["MP_REDIRECT_URI"] ?? `${appUrl()}/api/public/mercado-pago/callback`;
}

export function mpClientId() {
  return env("MP_CLIENT_ID");
}

// ---------- criptografia (AES-256-GCM) ----------

function encryptionKey(): Buffer {
  const key = Buffer.from(env("CONNECTIONS_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("CONNECTIONS_ENCRYPTION_KEY precisa ter 32 bytes em base64.");
  return key;
}

export function encryptSecret(plain: string, key = encryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(blob: string, key = encryptionKey()): string {
  const [v, iv, tag, ct] = blob.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Token criptografado em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

// ---------- assinatura do webhook ----------

export function verifyWebhookSignature(o: {
  header: string | null;
  requestId: string | null;
  dataId: string | null;
  secret?: string;
}): boolean {
  const parsed = parseSignatureHeader(o.header);
  if (!parsed) return false;
  const secret = o.secret ?? env("MP_WEBHOOK_SECRET");
  const expected = createHmac("sha256", secret)
    .update(signatureManifest({ dataId: o.dataId, requestId: o.requestId, ts: parsed.ts }))
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parsed.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- OAuth ----------

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  user_id: number | string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: mpClientId(), client_secret: env("MP_CLIENT_SECRET"), ...body }),
  });
  if (!res.ok) throw new Error(`Mercado Pago recusou o token (HTTP ${res.status}).`);
  const json = (await res.json()) as Partial<TokenResponse>;
  if (!json.access_token || !json.expires_in || json.user_id == null) throw new Error("Resposta de token incompleta.");
  return json as TokenResponse;
}

export function exchangeCode(code: string, codeVerifier: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: mpRedirectUri(),
    code_verifier: codeVerifier,
  });
}

/** Grava (ou troca) os tokens de uma conexão. */
export async function saveTokens(connectionId: string, companyId: string, t: TokenResponse) {
  const { error } = await mpAdmin.from("provider_tokens").upsert({
    connection_id: connectionId,
    company_id: companyId,
    provider: MP_PROVIDER,
    provider_user_id: String(t.user_id),
    access_token_enc: encryptSecret(t.access_token),
    refresh_token_enc: t.refresh_token ? encryptSecret(t.refresh_token) : null,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Não foi possível guardar a conexão.");
}

/** Token válido da conexão, renovando quando estiver perto de vencer. */
async function accessToken(connectionId: string): Promise<string> {
  const { data: row } = await mpAdmin
    .from("provider_tokens")
    .select("company_id, access_token_enc, refresh_token_enc, expires_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (!row) throw new Error("Conexão sem token. Conecte o Mercado Pago de novo.");

  const msLeft = new Date(row.expires_at).getTime() - Date.now();
  if (msLeft > MP_REFRESH_BEFORE_MS || !row.refresh_token_enc) {
    if (msLeft <= 0) throw new Error("A autorização do Mercado Pago venceu. Conecte de novo.");
    return decryptSecret(row.access_token_enc);
  }
  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptSecret(row.refresh_token_enc) });
  await saveTokens(connectionId, row.company_id, fresh);
  return fresh.access_token;
}

// ---------- vendas ----------

type Connection = { id: string; company_id: string; unit_id: string | null };

async function mpGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Mercado Pago respondeu HTTP ${res.status}.`);
  return (await res.json()) as T;
}

async function upsertPayments(conn: Connection, payments: MpPayment[]): Promise<number> {
  if (!conn.unit_id) throw new Error("Conexão sem unidade.");
  const rows = payments
    .map(mapPaymentToOrder)
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ ...r, company_id: conn.company_id, unit_id: conn.unit_id!, connection_id: conn.id }));
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin
    .from("sales_orders")
    .upsert(rows, { onConflict: "connection_id,external_id" });
  if (error) throw new Error("Não foi possível gravar as vendas.");
  return rows.length;
}

async function markSync(connectionId: string, error: string | null) {
  await supabaseAdmin
    .from("sales_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: error,
      status: error ? "erro" : "conectado",
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
}

const PAGE = 100;
const MAX_PAGES = 20;

/** Busca os pagamentos dos últimos `days` dias e grava como vendas. Idempotente. */
export async function syncConnection(conn: Connection, days = 30): Promise<{ imported: number }> {
  const startedAt = new Date().toISOString();
  try {
    const token = await accessToken(conn.id);
    const begin = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const end = new Date().toISOString();
    let imported = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({
        sort: "date_created",
        criteria: "desc",
        range: "date_created",
        begin_date: begin,
        end_date: end,
        limit: String(PAGE),
        offset: String(page * PAGE),
      });
      const res = await mpGet<{ results?: MpPayment[]; paging?: { total?: number } }>(token, `/v1/payments/search?${q}`);
      const results = res.results ?? [];
      imported += await upsertPayments(conn, results);
      if (results.length < PAGE || (page + 1) * PAGE >= (res.paging?.total ?? 0)) break;
    }
    await markSync(conn.id, null);
    await supabaseAdmin.from("sales_import_jobs").insert({
      company_id: conn.company_id,
      connection_id: conn.id,
      unit_id: conn.unit_id,
      period_start: begin.slice(0, 10),
      period_end: end.slice(0, 10),
      status: "concluido",
      rows_imported: imported,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    return { imported };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao sincronizar.";
    await markSync(conn.id, message);
    throw new Error(message);
  }
}

/** Aviso de pagamento: busca o pagamento com o token da conta e grava. */
export async function ingestPaymentNotification(providerUserId: string, paymentId: string) {
  const conn = await connectionByProviderUser(providerUserId);
  if (!conn) return { ignored: true };
  const token = await accessToken(conn.id);
  const payment = await mpGet<MpPayment>(token, `/v1/payments/${encodeURIComponent(paymentId)}`);
  const imported = await upsertPayments(conn, [payment]);
  await markSync(conn.id, null);
  return { imported };
}

export async function connectionByProviderUser(providerUserId: string): Promise<Connection | null> {
  const { data: tok } = await mpAdmin
    .from("provider_tokens")
    .select("connection_id")
    .eq("provider", MP_PROVIDER)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();
  if (!tok) return null;
  const { data } = await supabaseAdmin
    .from("sales_connections")
    .select("id, company_id, unit_id")
    .eq("id", tok.connection_id)
    .maybeSingle();
  return data ?? null;
}

/** Desliga a conexão: apaga os tokens e marca como desconectada. As vendas já importadas ficam. */
export async function disconnect(connectionId: string) {
  await mpAdmin.from("provider_tokens").delete().eq("connection_id", connectionId);
  await supabaseAdmin
    .from("sales_connections")
    .update({ status: "nao_conectado", active: false, updated_at: new Date().toISOString() })
    .eq("id", connectionId);
}
