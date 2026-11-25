import { describe, expect, it } from "vitest";
import { OTP_QR_OPTIONS, otpauthQrSvg } from "@/lib/otpQr";

const DUMMY = "otpauth://totp/RAGI:demo@example.invalid?secret=JBSWY3DPEHPK3PXP&issuer=RAGI";

describe("otpauth QR", () => {
  it("uses a large module size and a light quiet zone", () => {
    expect(OTP_QR_OPTIONS.width).toBeGreaterThanOrEqual(256);
    expect(OTP_QR_OPTIONS.margin).toBeGreaterThanOrEqual(4);
    expect(OTP_QR_OPTIONS.color.light.toLowerCase()).toBe("#ffffff");
  });

  it("renders the otpauth URI as SVG and rejects non-otpauth values", async () => {
    const svg = await otpauthQrSvg(DUMMY);
    expect(svg).toMatch(/<svg/i);
    expect(svg).toMatch(/viewBox/i);
    await expect(otpauthQrSvg("https://example.invalid")).rejects.toThrow(/otpauth/i);
  });
});
