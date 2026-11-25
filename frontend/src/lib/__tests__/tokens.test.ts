import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function lum(hex: string) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const rgb = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function ratio(a: string, b: string) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const css = readFileSync(resolve(import.meta.dirname, "../../app/arnova-tokens.css"), "utf8");
const light = css.split('[data-theme="light"]')[1];
const dark = css.split('[data-theme="dark"]')[0] + css.split('[data-theme="dark"]')[1].split('[data-theme="light"]')[0];

function tok(block: string, name: string) {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`missing --${name}`);
  return m[1];
}

describe("Sky ops tokens", () => {
  it("uses Pastel-dawn sky on navy, not brown or cream", () => {
    expect(tok(dark, "bg")).toBe("#070C1A");
    expect(tok(dark, "primary")).toBe("#8EC5FF");
    expect(tok(light, "side")).toBe("#0B1F4D");
    expect(tok(light, "bar-warning")).toBe("#CF4E08");
    expect(css.toLowerCase()).not.toMatch(/#302119|#f5ead9|#c38d58|#79533d/);
  });
  it("keeps AA text contrast and a 3:1 light warning bar", () => {
    expect(ratio(tok(dark, "text"), tok(dark, "bg"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(tok(light, "text"), tok(light, "bg"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(tok(light, "bar-warning"), tok(light, "chart-muted"))).toBeGreaterThanOrEqual(3);
  });
});
