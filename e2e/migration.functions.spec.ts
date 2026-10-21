import { test, expect } from "@playwright/test";
import { validateFace } from "../src/lib/face-validation.server";
import { hashPin, verifyPin, hashToken, newSessionToken } from "../src/lib/portal.server";

test("PINs e sessões continuam compatíveis no Node", async () => {
  const hash = await hashPin("4321");
  expect(await verifyPin("4321", hash)).toBe(true);
  expect(await verifyPin("1234", hash)).toBe(false);
  const token = newSessionToken();
  expect(token).toHaveLength(64);
  expect(await hashToken(token)).not.toBe(token);
});

test("visão independente preserva decisões e falha sem aprovar silenciosamente", async () => {
  const keys = ["FACE_VISION_ENDPOINT", "FACE_VISION_MODEL", "FACE_VISION_API_KEY", "FACE_VALIDATION_PROVIDER"];
  const previous = keys.map((key) => process.env[key]);
  const realFetch = globalThis.fetch;
  const input = { imageDataUrl: `data:image/png;base64,${Buffer.alloc(5000).toString("base64")}`, employeeId: "test", deliveryId: "test" };
  try {
    for (const key of keys) delete process.env[key];
    expect((await validateFace(input)).result.status).toBe("indisponivel");
    process.env["FACE_VALIDATION_PROVIDER"] = "vision_api";
    process.env["FACE_VISION_ENDPOINT"] = "http://127.0.0.1:9999/v1/chat/completions";
    process.env["FACE_VISION_MODEL"] = "vision-test";
    for (const [analysis, expected] of [
      [{ face_present: true, face_count: 1, occlusion: "nenhuma", lighting: "boa", sharpness: "boa" }, "aprovado"],
      [{ face_present: false, face_count: 0 }, "reprovado"],
      [{ face_present: true, face_count: 2 }, "reprovado"],
      [{ face_present: true, face_count: 1, screen_replay: true }, "reprovado"],
      [{ face_present: true, face_count: 1, occlusion: "mascara" }, "reprovado"],
      [{ face_present: true, face_count: 1, sharpness: "ruim" }, "reprovado"],
    ] as const) {
      globalThis.fetch = async (url, init) => {
        expect(String(url)).toBe(process.env["FACE_VISION_ENDPOINT"]);
        expect(JSON.parse(String(init?.body)).model).toBe("vision-test");
        return Response.json({ choices: [{ message: { content: JSON.stringify(analysis) } }] });
      };
      expect((await validateFace(input)).result.status).toBe(expected);
    }
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    expect((await validateFace(input)).result.status).toBe("indisponivel");
    process.env["FACE_VALIDATION_PROVIDER"] = "selfie_evidence";
    expect((await validateFace(input)).result.liveness).toBe("nao_avaliado");
  } finally {
    globalThis.fetch = realFetch;
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});
