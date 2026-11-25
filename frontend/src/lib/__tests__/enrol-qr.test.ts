import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("authenticator enrolment", () => {
  it("renders a QR from the otpauth URI and keeps the text key as a fallback", () => {
    const page = read("app/(auth)/verify/page.tsx");
    expect(page).toContain("AuthenticatorQr");
    expect(page).toContain("otpauth_uri");
    expect(page).toContain("setup.secret");
    expect(page).toMatch(/Can.?t scan|Enter this key|Add this key/i);
  });

  it("hides the setup token field when the fragment already prefilled it", () => {
    const page = read("app/(auth)/setup/page.tsx");
    expect(page).toContain("useSecretFromFragment");
    expect(page).toMatch(/token\.length\s*>=\s*32|prefilled/);
    expect(page).toMatch(/hide|hidden|!prefilled|prefilled &&/);
  });
});
