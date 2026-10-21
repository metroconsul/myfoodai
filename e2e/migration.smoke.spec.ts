import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`landing e login sem dependências do editor (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    const providerRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/lovable|gptengineer|gpt-eng\./i.test(request.url())) providerRequests.push(request.url());
    });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.evaluate(() => document.fonts.check('16px "Space Grotesk"'))).toBe(true);
    await page.screenshot({ path: `test-results/landing-${viewport.width}.png`, fullPage: true });
    await page.goto("/auth");
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    expect(providerRequests).toEqual([]);
  });
}

test("rotas protegidas redirecionam visitantes sem sessão", async ({ page }) => {
  for (const route of ["/app", "/app/employees", "/app/settings/aceite", "/app/inventory"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/auth$/);
  }
  for (const route of ["/portal", "/portal/escala", "/portal/ponto", "/portal/documentos"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/portal\/login$/);
  }
});

test("Google OAuth é encaminhado diretamente ao Supabase", async ({ page }) => {
  let authorization: URL | undefined;
  await page.route("**/auth/v1/authorize**", async (route) => {
    authorization = new URL(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "OAuth interceptado no teste" });
  });
  await page.goto("/auth");
  const expectedRedirect = new URL("/auth", page.url()).href;
  await page.getByRole("button", { name: /Google/ }).click();
  await expect.poll(() => authorization?.searchParams.get("provider")).toBe("google");
  expect(authorization?.searchParams.get("redirect_to")).toBe(expectedRedirect);
});

test("assets e rota inexistente retornam HTTP correto", async ({ request }) => {
  expect((await request.get("/favicon.ico")).status()).toBe(200);
  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect((await request.get("/rota-inexistente-de-teste")).status()).toBe(404);
});
