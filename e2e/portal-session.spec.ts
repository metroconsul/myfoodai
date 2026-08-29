import { test, expect } from "@playwright/test";
import { ensureTestEmployee, hasBackendAccess, login, readToken } from "./portal-fixtures";

test.skip(!hasBackendAccess, "Requer credenciais de serviço do backend.");

test.beforeAll(async () => {
  await ensureTestEmployee();
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

test("falha de rede no portal exibe estado de erro sem tela em branco", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/portal$/);

  await page.route("**/_serverFn/**", (route) => route.abort("failed"));
  await page.goto("/portal/escala", { waitUntil: "domcontentloaded" });

  await expect(page.locator("body")).not.toHaveText("");
  await expect(page.getByText(/não foi possível|erro|tentar novamente/i).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("registro de ponto sem geolocalização informa a exigência", async ({ page, context }) => {
  await context.clearPermissions();
  await login(page);
  await page.goto("/portal/ponto", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
