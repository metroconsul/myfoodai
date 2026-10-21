import Stripe from "stripe";

let client: Stripe | undefined;

export function getStripe() {
  const key = process.env["STRIPE_API_KEY"] ?? process.env["STRIPE_LIVE_API_KEY"] ?? process.env["STRIPE_TEST_API_KEY"];
  if (!key) throw new Error("Chave da Stripe não configurada no servidor.");
  client ??= new Stripe(key, { apiVersion: "2026-07-29.dahlia", typescript: true });
  return client;
}

export function appUrl() {
  const value = process.env["APP_URL"];
  if (!value) throw new Error("APP_URL não configurada no servidor.");
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("APP_URL inválida.");
  return url.origin;
}
