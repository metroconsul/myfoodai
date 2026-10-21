import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode, command }) => {
  // Server secrets stay in process.env; Vite only exposes VITE_* to the browser.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value;
  }
  return {
    plugins: [
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      ...(command === "build"
        ? [nitro({ preset: process.env["VERCEL"] ? "vercel" : "node-server" })]
        : []),
      react(),
    ],
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
    resolve: { tsconfigPaths: true, dedupe: ["react", "react-dom", "@tanstack/react-router"] },
    environments: {
      client: {
        optimizeDeps: {
          exclude: ["@tanstack/react-start-server"],
          include: ["@tanstack/history", "@tanstack/router-core", "@tanstack/router-core/isServer",
            "@tanstack/router-core/ssr/client", "@tanstack/router-core/ssr/server", "h3-v2", "seroval"],
        },
      },
    },
  };
});
