import { createFileRoute } from "@tanstack/react-router";

/** Diagnóstico temporário: verifica limites de PBKDF2 no runtime do servidor. */
export const Route = createFileRoute("/api/public/pbkdf2-check")({
  server: {
    handlers: {
      GET: async () => {
        const enc = new TextEncoder();
        const results: Record<string, string> = {};
        for (const iterations of [50_000, 100_000, 120_000]) {
          try {
            const key = await crypto.subtle.importKey("raw", enc.encode("1234"), "PBKDF2", false, [
              "deriveBits",
            ]);
            await crypto.subtle.deriveBits(
              { name: "PBKDF2", salt: enc.encode("salt"), iterations, hash: "SHA-256" },
              key,
              256,
            );
            results[String(iterations)] = "ok";
          } catch (e) {
            results[String(iterations)] = String(e);
          }
        }
        return Response.json(results);
      },
    },
  },
});
