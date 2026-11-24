import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.RAGI_WEB_URL ?? "http://localhost:3410", trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/owner.json" }, dependencies: ["setup"], testIgnore: /auth\.setup\.ts/ },
  ],
});
