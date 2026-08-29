import { test, expect } from "@playwright/test";
import { ensureTestEmployee, hasTestEmployee, login, readToken, resetLock } from "./portal-fixtures";

test.skip(!hasTestEmployee, "Configure E2E_PORTAL_CPF e E2E_PORTAL_PIN.");

test.beforeAll(async () => {
  await ensureTestEmployee();
});

test.beforeEach(async () => {
  await resetLock();
});

test("sessão expirada volta ao login e limpa o token local", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/portal$/);

  await page.evaluate(() => window.localStorage.setItem("portal_token", "a".repeat(64)));
  await page.goto("/portal", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/portal\/login$/, { timeout: 20_000 });
  expect(await readToken(page)).toBeNull();
});

test("acesso direto sem sessão redireciona para o login", async ({ page }) => {
  await page.goto("/portal/ponto", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/portal\/login$/, { timeout: 20_000 });
});

test("falha de rede no portal não deixa a tela em branco", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/portal$/);

  await page.route("**/_serverFn/**", (route) => route.abort("failed"));
  await page.goto("/portal/escala", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("navigation").or(page.getByRole("main"))).toBeVisible({
    timeout: 20_000,
  });
});
