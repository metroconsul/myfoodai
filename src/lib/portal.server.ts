/** Helpers server-only do Portal do Colaborador (hash de PIN, tokens, geo). */

const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function pbkdf2(pin: string, saltHex: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: Uint8Array.from(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16))), iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPin(pin: string) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await pbkdf2(pin, salt);
  return `pbkdf2$${salt}$${hash}`;
}

export async function verifyPin(pin: string, stored?: string | null) {
  if (!stored) return false;
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const candidate = await pbkdf2(pin, salt);
  return candidate === hash;
}

export function newSessionToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

export async function hashToken(token: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(token)));
}

/** Distância aproximada em metros entre dois pontos. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export const onlyDigits = (v: string) => v.replace(/\D+/g, "");
