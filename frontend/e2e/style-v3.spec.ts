import { test, type Page } from "@playwright/test";

const OUT = process.env.RAGI_SCREENSHOT_DIR ?? "/workspace/arnova-v2/screenshots-v3/ragi";

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate((t) => {
    localStorage.setItem("arnova-theme", t);
    document.documentElement.dataset.theme = t;
  }, theme);
}

async function ready(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
}

async function shot(page: Page, name: string, fullPage = true) {
  await ready(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

test.describe("public auth shots", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("login signup setup mfa", async ({ page, browser }) => {
    test.skip(!process.env.STYLE_SHOTS && !process.env.SCREENSHOTS, "set STYLE_SHOTS=1");
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const theme of ["dark", "light"] as const) {
      await page.goto("/login");
      await setTheme(page, theme);
      await page.reload();
      await shot(page, `desktop-login-${theme}`);

      await page.goto("/signup");
      await setTheme(page, theme);
      await page.reload();
      await shot(page, `desktop-signup-closed-${theme}`);

      await page.goto("/setup");
      await setTheme(page, theme);
      await page.reload();
      await shot(page, `desktop-setup-${theme}`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await setTheme(page, "dark");
    await page.reload();
    await shot(page, "phone-login-dark", false);

    // MFA: sign in and stop on the verify screen (credentials from the environment only).
    const email = process.env.RAGI_E2E_EMAIL;
    const password = process.env.RAGI_E2E_PASSWORD;
    if (email && password) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
      const p = await ctx.newPage();
      await p.goto("/login");
      await setTheme(p, "dark");
      await p.reload();
      await p.locator("#email").fill(email);
      await p.locator("#password").fill(password);
      await p.getByRole("button", { name: /^sign in$/i }).click();
      await p.waitForURL(/\/verify/);
      await shot(p, "desktop-mfa-dark");
      await p.setViewportSize({ width: 390, height: 844 });
      await shot(p, "phone-mfa-dark", false);
      await ctx.close();
    }
  });
});

test.describe("signed-in shots", () => {
  test("workspace pages", async ({ page }) => {
    test.skip(!process.env.STYLE_SHOTS && !process.env.SCREENSHOTS, "set STYLE_SHOTS=1");
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    const pages = [
      ["/dashboard", "home"],
      ["/projects", "projects"],
      ["/pipeline", "pipeline"],
      ["/future-projects", "future-projects"],
      ["/showcase", "showcase"],
    ] as const;

    for (const theme of ["dark", "light"] as const) {
      for (const [path, name] of pages) {
        await page.goto(path);
        await setTheme(page, theme);
        await page.reload();
        await shot(page, `desktop-${name}-${theme}`);
      }
    }

    // Viewer: open the first showcase site if one is listed.
    await page.goto("/showcase");
    await setTheme(page, "dark");
    await page.reload();
    await ready(page);
    const first = page.locator("button[type='button']").filter({ hasText: /./ }).first();
    if (await first.count()) {
      await first.click();
      await page.waitForTimeout(1500);
      await shot(page, "desktop-showcase-viewer-dark");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await setTheme(page, "dark");
    await page.reload();
    await shot(page, "phone-home-dark", false);
    await page.goto("/showcase");
    await ready(page);
    await shot(page, "phone-showcase-dark", false);
  });
});
