import { db } from "../db.js";
import { withOwnerVault } from "../vault.js";
import type { VaultExport } from "./export-vault.js";

/**
 * Merge vault JSON into durable DB. Never deletes existing rows.
 * Owner seals / hashes are never imported or overwritten.
 */
export async function importVaultMerge(ownerId: string, payload: VaultExport) {
  const { enc } = await withOwnerVault(ownerId);
  let added = 0;

  if (payload.mode === "work" || payload.mode === "personal") {
    await db.modeState.upsert({
      where: { ownerId },
      create: { ownerId, mode: payload.mode },
      update: { mode: payload.mode },
    });
  }

  for (const j of payload.jobs ?? []) {
    await db.jobEntry.create({
      data: {
        ownerId,
        titleEnc: enc(j.title),
        companyEnc: j.company ? enc(j.company) : null,
        status: j.status ?? "watch",
        urlEnc: j.url ? enc(j.url) : null,
        notesEnc: j.notes ? enc(j.notes) : null,
      },
    });
    added++;
  }

  for (const n of payload.notes ?? []) {
    await db.secureNote.create({
      data: {
        ownerId,
        kind: n.kind ?? "note",
        titleEnc: enc(n.title),
        bodyEnc: enc(n.body ?? ""),
      },
    });
    added++;
  }

  for (const f of payload.focus ?? []) {
    await db.focusBlock.create({
      data: {
        ownerId,
        labelEnc: enc(f.label),
        startsAt: new Date(f.startsAt),
        endsAt: new Date(f.endsAt),
        completed: Boolean(f.completed),
      },
    });
    added++;
  }

  for (const p of payload.projects ?? []) {
    await db.project.create({
      data: {
        ownerId,
        titleEnc: enc(p.title),
        notesEnc: p.notes ? enc(p.notes) : null,
        realm: p.realm ?? "personal",
        status: p.status ?? "active",
        progress: p.progress ?? 0,
        dueAt: p.dueAt ? new Date(p.dueAt) : null,
      },
    });
    added++;
  }

  for (const g of payload.goals ?? []) {
    await db.goal.create({
      data: {
        ownerId,
        titleEnc: enc(g.title),
        realm: g.realm ?? "personal",
        status: g.status ?? "active",
        progress: g.progress ?? 0,
        targetEnc: g.target ? enc(g.target) : null,
      },
    });
    added++;
  }

  for (const a of payload.activities ?? []) {
    await db.activity.create({
      data: {
        ownerId,
        titleEnc: enc(a.title),
        kind: a.kind ?? "task",
        day: new Date(a.day),
        done: Boolean(a.done),
      },
    });
    added++;
  }

  for (const f of payload.finance ?? []) {
    await db.financeEntry.create({
      data: {
        ownerId,
        kind: f.kind,
        amountCents: f.amountCents,
        labelEnc: enc(f.label),
        categoryEnc: f.category ? enc(f.category) : null,
        at: new Date(f.at),
      },
    });
    added++;
  }

  for (const m of payload.meetings ?? []) {
    await db.meeting.create({
      data: {
        ownerId,
        titleEnc: enc(m.title),
        placeEnc: m.place ? enc(m.place) : null,
        startsAt: new Date(m.startsAt),
        endsAt: new Date(m.endsAt),
        status: m.status ?? "scheduled",
      },
    });
    added++;
  }

  for (const r of payload.reminders ?? []) {
    await db.reminder.create({
      data: {
        ownerId,
        titleEnc: enc(r.title),
        dueAt: new Date(r.dueAt),
        priority: r.priority ?? "normal",
        done: Boolean(r.done),
      },
    });
    added++;
  }

  for (const e of payload.emergencies ?? []) {
    await db.emergency.create({
      data: {
        ownerId,
        titleEnc: enc(e.title),
        bodyEnc: enc(e.body ?? ""),
        severity: e.severity ?? "high",
        active: e.active !== false,
      },
    });
    added++;
  }

  return { ok: true as const, added, mode: "merge" as const };
}
