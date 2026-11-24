import { test } from "@playwright/test";

// Run on demand: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts
const OUT = process.env.RAGI_SCREENSHOT_DIR ?? "../screenshots";
const PAGES = ["dashboard", "projects", "tasks", "pipeline", "clients", "time", "billing", "agents", "approvals", "reports", "websites", "settings", "audit-logs"];

for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]] as const) {
  test.describe(label, () => {
    test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1");
    test.use({ viewport, deviceScaleFactor: 2, hasTouch: label === "mobile", isMobile: label === "mobile" });
    test(`${label} pages`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const p of PAGES) {
        await page.goto(`/${p}`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${OUT}/${label}-${p}.png`, fullPage: label === "desktop" });
      }
      if (label === "mobile") {
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");
        await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "More" }).click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/mobile-more-sheet.png` });
      }
      await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
      await page.goto("/dashboard");
      await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${label}-dashboard-light.png`, fullPage: label === "desktop" });
    });
  });
}

test("login page", async ({ browser }) => {
  test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1");
  for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]] as const) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${label}-login.png` });
    await ctx.close();
  }
});
