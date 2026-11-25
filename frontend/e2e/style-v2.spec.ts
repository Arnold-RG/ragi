import { test, type Page } from "@playwright/test";

const OUT = process.env.RAGI_SCREENSHOT_DIR ?? "/workspace/arnova-v2/screenshots-v2/ragi";

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

test("style v2 shots", async ({ page }) => {
  test.skip(!process.env.STYLE_SHOTS && !process.env.SCREENSHOTS, "set STYLE_SHOTS=1");
  test.setTimeout(120_000);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");
  await setTheme(page, "dark");
  await page.reload();
  await ready(page);
  await page.screenshot({ path: `${OUT}/desktop-dashboard-dark.png`, fullPage: true });

  await setTheme(page, "light");
  await page.reload();
  await ready(page);
  await page.screenshot({ path: `${OUT}/desktop-dashboard-light.png`, fullPage: true });

  await setTheme(page, "dark");
  await page.goto("/pipeline");
  await ready(page);
  await page.screenshot({ path: `${OUT}/desktop-kanban-dark.png`, fullPage: true });

  await setTheme(page, "light");
  await page.reload();
  await ready(page);
  await page.screenshot({ path: `${OUT}/desktop-kanban-light.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, "dark");
  await page.goto("/dashboard");
  await ready(page);
  await page.screenshot({ path: `${OUT}/phone-dashboard-dark.png` });

  await setTheme(page, "light");
  await page.reload();
  await ready(page);
  await page.screenshot({ path: `${OUT}/phone-dashboard-light.png` });

  await setTheme(page, "dark");
  await page.goto("/pipeline");
  await ready(page);
  await page.screenshot({ path: `${OUT}/phone-kanban-dark.png` });
});
