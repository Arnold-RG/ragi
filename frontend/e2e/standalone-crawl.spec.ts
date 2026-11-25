import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const RAGI = process.env.RAGI_WEB_URL ?? "http://localhost:3411";
const ROUTES = [
  "/login",
  "/unlock",
  "/dashboard",
  "/projects",
  "/agents",
  "/approvals",
  "/pipeline",
  "/billing",
  "/retainers",
  "/future-projects",
  "/clients",
  "/settings",
  "/reports",
  "/tasks",
  "/time",
  "/showcase",
  "/activity",
  "/audit-logs",
  "/websites",
];
const VIEWPORTS = [
  { name: "390", width: 390, height: 844, isMobile: true },
  { name: "desktop", width: 1280, height: 800, isMobile: false },
] as const;

function sessionCookie() {
  const file = process.env.RAGI_SESSION_COOKIE_FILE ?? "/workspace/arnova-v2/runtime/ragi-session.cookie";
  if (!existsSync(file)) return null;
  const value = readFileSync(file, "utf8").trim();
  if (!value) return null;
  return { name: "__Host-ragi_session", value, domain: "localhost", path: "/", httpOnly: true, secure: true as const, sameSite: "Lax" as const };
}

async function assertClean(page: Page, errors: string[]) {
  const box = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(box.sw, `overflow ${box.sw} > ${box.cw} at ${page.url()}`).toBeLessThanOrEqual(box.cw);
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll("a[href], button")].map((a) => ({
      href: (a as HTMLAnchorElement).getAttribute?.("href") || "",
      text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    })).filter((x) =>
      /open( in)? money hub|connect (to )?(our )?money hub/i.test(x.text)
    ),
  );
  expect(bad, `cross-app Money Hub prompt at ${page.url()}`).toEqual([]);
  expect(errors, `console errors at ${page.url()}`).toEqual([]);
}

for (const vp of VIEWPORTS) {
  test(`crawl at ${vp.name}: no overflow, no Money Hub links, no console errors`, async ({ browser }) => {
    const cookie = sessionCookie();
    test.skip(!cookie, "no local RAGI session cookie");
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.isMobile });
    await ctx.addCookies([cookie!]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    const ignorable = (text: string) =>
      /WebSocket connection to 'ws:\/\/[^']+\/ws\/operations' failed/.test(text);
    page.on("pageerror", (err) => {
      if (!ignorable(String(err))) errors.push(String(err));
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" && !ignorable(msg.text())) errors.push(msg.text());
    });
    for (const route of ROUTES) {
      errors.length = 0;
      const res = await page.goto(`${RAGI}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(600);
      if (route !== "/login" && route !== "/unlock") {
        expect(page.url(), `session lost at ${route}`).not.toMatch(/\/login/);
      }
      expect(res?.ok() || res?.status() === 304, `bad status ${res?.status()} at ${route}`).toBeTruthy();
      await assertClean(page, [...errors]);
      if (route === "/dashboard" && vp.isMobile) {
        await page.locator("nav.tabbar button.tab").last().click({ force: true });
        await page.waitForTimeout(400);
        const dialog = await page.evaluate(() => {
          const d = document.querySelector("dialog[open], dialog.sheet");
          if (!d) return null;
          return { w: d.getBoundingClientRect().width, vw: window.innerWidth };
        });
        if (dialog) expect(dialog.w).toBeLessThanOrEqual(dialog.vw + 1);
        await assertClean(page, [...errors]);
        const moneyPrompts = await page.getByText(/open( in)? money hub|connect (to )?(our )?money hub/i).count();
        expect(moneyPrompts, "Money Hub connect/open prompt still in the More sheet").toBe(0);
        if (vp.name === "390") {
          await page.screenshot({ path: "/workspace/arnova-v2/screenshots/mobile/after-ragi-more-sheet-390.png", fullPage: false });
        }
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
    await page.goto(`${RAGI}/projects`, { waitUntil: "domcontentloaded" });
    const first = page.locator("a[href*='/projects/']").first();
    if (await first.count()) {
      errors.length = 0;
      await first.click();
      await page.waitForTimeout(800);
      await assertClean(page, [...errors]);
      expect(await page.getByText(/open in money hub/i).count()).toBe(0);
      if (vp.name === "390") {
        await page.screenshot({ path: "/workspace/arnova-v2/screenshots/mobile/after-ragi-project-detail-390.png", fullPage: false });
      }
    }
    await ctx.close();
  });
}
