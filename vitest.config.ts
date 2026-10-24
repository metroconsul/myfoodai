import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuração separada do vite.config.ts para que os testes unitários não carreguem
// os plugins do TanStack Start/Nitro. Só testa código puro (sem rede, sem banco).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
