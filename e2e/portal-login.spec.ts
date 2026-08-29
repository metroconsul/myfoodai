import { test, expect } from "@playwright/test";
import {
  ensureTestEmployee,
  hasBackendAccess,
  login,
  readToken,
  resetLock,
  TEST_NAME,
  TEST_PIN,
} from "./portal-fixtures";

test.skip(!hasBackendAccess, "Requer credenciais de serviço do backend.");

let employeeId = "";

test.beforeAll(async () => {
  employeeId = await ensureTestEmployee();
});

test.beforeEach(async () => {
  await resetLock(employeeId);
});

test("login com CPF e PIN válidos abre o portal", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText(TEST_NAME)).toBeVisible();
  expect(await readToken(page)).toBeTruthy();
  await expect(page.getByRole("link", { name: "Escala" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ponto" })).toBeVisible();
});

test("PIN incorreto mantém o usuário no login e mostra mensagem", async ({ page }) => {
  await login(page, "1111");
  await expect(page.locator("[data-sonner-toast]")).toContainText("CPF ou PIN inválidos.");
  await expect(page).toHaveURL(/\/portal\/login$/);
  expect(await readToken(page)).toBeNull();
});

test("CPF sem cadastro recebe erro genérico, sem vazar existência do usuário", async ({ page }) => {
  await login(page, TEST_PIN, "11111111111");
  await expect(page.locator("[data-sonner-toast]")).toContainText("CPF ou PIN inválidos.");
  expect(await readToken(page)).toBeNull();
});

test("cinco tentativas incorretas bloqueiam o acesso temporariamente", async ({ page }) => {
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
