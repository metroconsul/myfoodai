import { test, expect } from "@playwright/test";
import {
  canSeed,
  ensureTestEmployee,
  hasTestEmployee,
  login,
  readToken,
  resetLock,
  TEST_PIN,
} from "./portal-fixtures";

test.skip(!hasTestEmployee, "Configure E2E_PORTAL_CPF e E2E_PORTAL_PIN.");

test.beforeAll(async () => {
  await ensureTestEmployee();
});

test.beforeEach(async () => {
  await resetLock();
});

test("login com CPF e PIN válidos abre o portal", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/portal$/);
  expect(await readToken(page)).toBeTruthy();
  const nav = page.getByRole("navigation", { name: "Navegação do portal" });
  await expect(nav.getByRole("link", { name: "Escala" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Ponto", exact: true })).toBeVisible();

});

test("PIN incorreto mantém o usuário no login e mostra mensagem", async ({ page }) => {
  await login(page, "1111");
  await expect(page.locator("[data-sonner-toast]")).toContainText("CPF ou PIN inválidos.");
  await expect(page).toHaveURL(/\/portal\/login$/);
  expect(await readToken(page)).toBeNull();
});

test("CPF sem cadastro recebe erro genérico, sem revelar se o usuário existe", async ({ page }) => {
  await login(page, TEST_PIN, "11111111111");
  await expect(page.locator("[data-sonner-toast]")).toContainText("CPF ou PIN inválidos.");
  expect(await readToken(page)).toBeNull();
});

test("cinco tentativas incorretas bloqueiam o acesso temporariamente", async ({ page }) => {
  test.skip(!canSeed, "Exige acesso administrativo para desbloquear depois.");
  for (let i = 0; i < 5; i++) {
    await login(page, "9999");
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
  }
  await login(page, TEST_PIN);
  await expect(page.locator("[data-sonner-toast]")).toContainText("Muitas tentativas");
  expect(await readToken(page)).toBeNull();
});

test("falha de rede no login mostra estado de erro amigável", async ({ page }) => {
  await page.route("**/_serverFn/**", (route) => route.abort("failed"));
  await login(page);
  await expect(page.locator("[data-sonner-toast]")).toContainText("Não foi possível entrar agora.");
  await expect(page).toHaveURL(/\/portal\/login$/);
});
