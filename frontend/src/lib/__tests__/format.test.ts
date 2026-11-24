import { describe, expect, it } from "vitest";
import { formatMinutes, formatMoney, humanize, relativeTime } from "@/lib/format";

describe("formatMoney", () => {
  it("formats decimal strings without floats and respects minor units", () => {
    expect(formatMoney("1234567.5", "PLN")).toBe("1\u202f234\u202f567.50 PLN");
    expect(formatMoney("25000", "RWF")).toBe("25\u202f000 RWF");
    expect(formatMoney("0.1", "USD")).toBe("0.10 USD");
  });
  it("never shows a made-up number for missing or bad input", () => {
    expect(formatMoney(null, "PLN")).toBe("—");
    expect(formatMoney("", "PLN")).toBe("—");
    expect(formatMoney("1e3", "PLN")).toBe("—");
  });
  it("keeps precision that floats would lose", () => {
    expect(formatMoney("90071992547409.93", "EUR")).toBe("90\u202f071\u202f992\u202f547\u202f409.93 EUR");
  });
});

describe("other helpers", () => {
  it("formats minutes", () => {
    expect(formatMinutes(0)).toMatch(/0/);
    expect(formatMinutes(135)).toMatch(/2\s*h/);
  });
  it("humanizes identifiers", () => {
    expect(humanize("client-website")).toMatch(/client website/i);
  });
  it("gives relative times", () => {
    const now = new Date("2026-11-25T12:00:00Z");
    expect(relativeTime("2026-11-25T11:59:30Z", now)).toMatch(/now|second|just/i);
  });
});
