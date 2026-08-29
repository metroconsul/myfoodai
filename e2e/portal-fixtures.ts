import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Utilitários dos testes E2E do Portal do Colaborador.
 * Requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no ambiente de teste
 * (a suíte é pulada automaticamente quando não estiverem disponíveis).
 */

export const TEST_CPF = "00000000191";
export const TEST_PIN = "4321";
export const TEST_NAME = "QA Teste Portal";

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

export const hasBackendAccess = Boolean(url && serviceKey);

export function admin() {
  if (!url || !serviceKey) throw new Error("Credenciais de teste ausentes.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

const encoder = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** Mesmo algoritmo de `src/lib/portal.server.ts`. */
export async function hashPin(pin: string) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: Uint8Array.from(salt.match(/.{2}/g)!.map((h) => parseInt(h, 16))),
      iterations: 120_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return `pbkdf2$${salt}$${toHex(bits)}`;
}

/** Garante um colaborador de teste ativo com PIN conhecido. */
export async function ensureTestEmployee() {
  const db = admin();
  const { data: base } = await db
    .from("employees")
    .select("company_id, unit_id")
    .not("company_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!base) throw new Error("Nenhuma empresa disponível para o teste.");

  const patch = {
    company_id: base.company_id,
    unit_id: base.unit_id,
    full_name: TEST_NAME,
    cpf: TEST_CPF,
    employment_status: "ativo" as const,
    portal_pin_hash: await hashPin(TEST_PIN),
    portal_pin_set_at: new Date().toISOString(),
    portal_failed_attempts: 0,
    portal_locked_until: null,
  };

  const { data: existing } = await db
    .from("employees")
    .select("id")
    .eq("cpf", TEST_CPF)
    .maybeSingle();

  if (existing) {
    await db.from("employees").update(patch).eq("id", existing.id);
    return existing.id as string;
  }
  const { data: created, error } = await db.from("employees").insert(patch).select("id").single();
  if (error) throw error;
  return created.id as string;
}

/** Desbloqueia o colaborador após cenários de tentativas inválidas. */
export async function resetLock(employeeId: string) {
  await admin()
    .from("employees")
    .update({ portal_failed_attempts: 0, portal_locked_until: null })
    .eq("id", employeeId);
}

export async function login(page: Page, pin = TEST_PIN, cpf = TEST_CPF) {
  await page.goto("/portal/login", { waitUntil: "domcontentloaded" });
  await page.locator("#cpf").fill(cpf);
  await page.locator("#pin").fill(pin);
  await page.getByRole("button", { name: "Entrar no portal" }).click();
}

export async function readToken(page: Page) {
  return page.evaluate(() => window.localStorage.getItem("portal_token"));
}
