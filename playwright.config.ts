import { defineConfig, devices } from "@playwright/test";

/** Testes E2E do Portal do Colaborador (CPF + PIN). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
  },
});
