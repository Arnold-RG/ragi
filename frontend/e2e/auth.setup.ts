import { expect, test as setup } from "@playwright/test";
import { totp } from "./totp";

// Credentials come from the environment (scripts/e2e.sh reads the 0600 runtime file); never committed.
const email = process.env.RAGI_E2E_EMAIL;
const password = process.env.RAGI_E2E_PASSWORD;
const secret = process.env.RAGI_E2E_TOTP_SECRET;

setup("sign in with password + TOTP", async ({ page }) => {
  setup.skip(!email || !password || !secret, "RAGI_E2E_* not set");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/\/verify/);
  // Replay protection: wait for a fresh 30-second step if this one may already be used.
  if (Date.now() / 1000 % 30 > 25) await page.waitForTimeout(6000);
  await page.getByLabel("Verification code").fill(totp(secret!));
  await page.getByRole("button", { name: /verify/i }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Arnold");
  await page.context().storageState({ path: "e2e/.auth/owner.json" });
});
