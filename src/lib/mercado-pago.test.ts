import { createHash, createHmac, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import { decryptSecret, encryptSecret, verifyWebhookSignature } from "./mercado-pago.server";
import {
  buildAuthorizeUrl,
  mapPaymentToOrder,
  parseSignatureHeader,
  pkceChallenge,
  randomToken,
  signatureManifest,
} from "./mercado-pago.shared";

describe("mapPaymentToOrder", () => {
  const base = {
    id: 123456789,
    status: "approved",
    transaction_amount: 45.9,
    date_approved: "2026-10-24T12:30:00.000-03:00",
    date_created: "2026-10-24T12:29:00.000-03:00",
    payment_type_id: "credit_card",
    payment_method_id: "visa",
    transaction_details: { net_received_amount: 44.12 },
  };

  it("maps an approved payment", () => {
    expect(mapPaymentToOrder(base)).toEqual({
      external_id: "123456789",
      channel: "Mercado Pago · Crédito",
      ordered_at: "2026-10-24T15:30:00.000Z",
      gross_amount: 45.9,
      net_amount: 44.12,
      is_cancelled: false,
    });
  });

  it("marks refunds and chargebacks as cancelled", () => {
    expect(mapPaymentToOrder({ ...base, status: "refunded" })?.is_cancelled).toBe(true);
    expect(mapPaymentToOrder({ ...base, status: "charged_back" })?.is_cancelled).toBe(true);
  });

  it("skips payments that were never approved", () => {
    for (const status of ["pending", "in_process", "rejected", "cancelled", "authorized"]) {
      expect(mapPaymentToOrder({ ...base, status })).toBeNull();
    }
  });

  it("names Pix and falls back to creation date", () => {
    const row = mapPaymentToOrder({ ...base, payment_method_id: "pix", payment_type_id: "bank_transfer", date_approved: null });
    expect(row?.channel).toBe("Mercado Pago · Pix");
    expect(row?.ordered_at).toBe("2026-10-24T15:29:00.000Z");
  });

  it("keeps net amount null when missing", () => {
    expect(mapPaymentToOrder({ ...base, transaction_details: null })?.net_amount).toBeNull();
  });
});

describe("PKCE and authorize URL", () => {
  it("computes the S256 challenge", async () => {
    const verifier = randomToken(48);
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(await pkceChallenge(verifier)).toBe(expected);
  });

  it("generates url-safe random tokens", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  it("builds the authorization URL", () => {
    const u = new URL(
      buildAuthorizeUrl({ clientId: "123", redirectUri: "https://myfoodsai.com/cb", state: "st", challenge: "ch" }),
    );
    expect(u.origin + u.pathname).toBe("https://auth.mercadopago.com/authorization");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: "123",
      response_type: "code",
      platform_id: "mp",
      state: "st",
      redirect_uri: "https://myfoodsai.com/cb",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
  });
});

describe("token encryption", () => {
  const key = randomBytes(32);

  it("round-trips and does not leak the plain text", () => {
    const blob = encryptSecret("APP_USR-secret-token", key);
    expect(blob).not.toContain("APP_USR");
    expect(decryptSecret(blob, key)).toBe("APP_USR-secret-token");
  });

  it("rejects tampering and the wrong key", () => {
    const blob = encryptSecret("abc", key);
    const parts = blob.split(":");
    const ct = Buffer.from(parts[3]!, "base64");
    ct[0] = ct[0]! ^ 1;
    expect(() => decryptSecret([parts[0], parts[1], parts[2], ct.toString("base64")].join(":"), key)).toThrow();
    expect(() => decryptSecret(blob, randomBytes(32))).toThrow();
  });
});

describe("webhook signature", () => {
  const secret = "test-webhook-secret";
  const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

  it("parses the header", () => {
    expect(parseSignatureHeader("ts=1704908010,v1=abc")).toEqual({ ts: "1704908010", v1: "abc" });
    expect(parseSignatureHeader("v1=abc")).toBeNull();
    expect(parseSignatureHeader(null)).toBeNull();
  });

  it("builds the manifest like the documentation", () => {
    expect(signatureManifest({ dataId: "ABC123", requestId: "req-1", ts: "1" })).toBe("id:abc123;request-id:req-1;ts:1;");
    expect(signatureManifest({ dataId: null, requestId: null, ts: "1" })).toBe("ts:1;");
  });

  it("accepts a valid signature and rejects a forged one", () => {
    const v1 = sign("id:999;request-id:r;ts:42;");
    expect(verifyWebhookSignature({ header: `ts=42,v1=${v1}`, requestId: "r", dataId: "999", secret })).toBe(true);
    expect(verifyWebhookSignature({ header: `ts=42,v1=${v1}`, requestId: "r", dataId: "1000", secret })).toBe(false);
    expect(verifyWebhookSignature({ header: `ts=43,v1=${v1}`, requestId: "r", dataId: "999", secret })).toBe(false);
    expect(verifyWebhookSignature({ header: null, requestId: "r", dataId: "999", secret })).toBe(false);
  });
});
