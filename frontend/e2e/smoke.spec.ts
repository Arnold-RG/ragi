import { expect, test } from "@playwright/test";

test("unauthenticated visitors are sent to sign-in by the server", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await ctx.close();
});

test("dashboard shows real registry data and the agent emergency stop", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(/Agent emergency stop is on/)).toBeVisible();
  await expect(page.getByText("RAGI v2").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /pause updates/i })).toBeVisible();
});

test("tasks: keyboard create opens a dialog", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "New task" })).toBeHidden();
});

test("agents are placeholders and a dispatch is blocked by the guard", async ({ page }) => {
  await page.goto("/agents");
  for (const n of ["Jarvis", "Forge", "Sentinel", "Nova", "Mentor"]) await expect(page.getByText(new RegExp(`^${n}$`, "i")).first()).toBeVisible();
  await page.getByRole("button", { name: "Test dispatch" }).first().click();
  await expect(page.getByText(/Guard result/)).toBeVisible();
  await expect(page.getByText("blocked").first()).toBeVisible();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("bottom bar follows spec §12 and More opens a sheet", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const l of ["Home", "Projects", "Agents", "Reports", "More"]) await expect(nav.getByText(l, { exact: true })).toBeVisible();
    await nav.getByRole("button", { name: "More" }).click({ timeout: 8000 });
    await expect(page.getByRole("dialog", { name: "More" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "true");
  });
});
