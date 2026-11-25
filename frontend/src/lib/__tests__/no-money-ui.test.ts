import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, acc: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|css)$/.test(name)) acc.push(p);
  }
  return acc;
}

const src = resolve(import.meta.dirname, "../..");
const files = walk(src).filter((p) => !p.includes("/lib/format") && !p.includes("/__tests__/"));

describe("RAGI shows no money", () => {
  it("does not format or label currency amounts in the UI", () => {
    const hits: string[] = [];
    for (const f of files) {
      const t = readFileSync(f, "utf8");
      if (t.includes("formatMoney(")) hits.push(`${f}: formatMoney`);
      if (/Invoices outstanding/.test(t)) hits.push(`${f}: invoices KPI`);
      if (/value_by_currency/.test(t) && !f.endsWith("types.ts")) hits.push(`${f}: pipeline value`);
    }
    expect(hits).toEqual([]);
  });

  it("drops the invoices nav item", () => {
    const nav = readFileSync(join(src, "components/layout/nav.ts"), "utf8");
    expect(nav).not.toMatch(/\/billing/);
    expect(nav).not.toMatch(/invoice/i);
  });
});

describe("operations home", () => {
  it("shows project and agent KPIs, progress, status chart, feed and throughput", () => {
    const dash = readFileSync(join(src, "app/(workspace)/dashboard/page.tsx"), "utf8");
    for (const s of [
      'label="In progress"',
      'label="Finished"',
      'label="Failed / blocked"',
      'label="Agent tasks today"',
      "Project progress",
      "Projects by status",
      "Agent work",
      "LiveActivity",
      "ThroughputChart",
      "OpenInMoneyHub",
    ]) {
      expect(dash).toContain(s);
    }
    expect(dash).not.toMatch(/formatMoney|Invoices outstanding|by_currency|total_balance/);
  });
});
