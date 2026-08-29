import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Utilitários dos testes E2E do Portal do Colaborador (CPF + PIN).
 *
 * Credenciais de teste:
 * - E2E_PORTAL_CPF / E2E_PORTAL_PIN apontam para um colaborador de teste já cadastrado.
 * - Opcional: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY permitem semear o colaborador
 *   e desbloquear tentativas automaticamente entre os cenários.
 */

export const TEST_CPF = process.env["E2E_PORTAL_CPF"] ?? "00000000191";
export const TEST_PIN = process.env["E2E_PORTAL_PIN"] ?? "4321";

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

/** Os testes só rodam quando existe um colaborador de teste configurado. */
export const hasTestEmployee = Boolean(TEST_CPF && TEST_PIN);
/** Semeadura e desbloqueio automáticos exigem acesso administrativo ao banco. */
export const canSeed = Boolean(url && serviceKey);

function admin() {
  return createClient(url!, serviceKey!, { auth: { persistSession: false } });
}

const encoder = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** Mesmo algoritmo de hash de `src/lib/portal.server.ts`. */
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

/** Garante um colaborador de teste ativo com PIN conhecido (no-op sem acesso admin). */
export async function ensureTestEmployee() {
  if (!canSeed) return null;
  const db = admin();
  const { data: base } = await db
    .from("employees")
    .select("company_id, unit_id")
    .not("company_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!base) return null;

  const patch = {
    company_id: base.company_id,
    unit_id: base.unit_id,
    full_name: "QA Teste Portal",
    cpf: TEST_CPF,
    employment_status: "ativo",
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
  const { data: created } = await db.from("employees").insert(patch).select("id").maybeSingle();
  return (created?.id as string) ?? null;
}

/** Zera tentativas/bloqueio entre cenários (no-op sem acesso admin). */
export async function resetLock() {
  if (!canSeed) return;
  await admin()
    .from("employees")
    .update({ portal_failed_attempts: 0, portal_locked_until: null })
    .eq("cpf", TEST_CPF);
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
