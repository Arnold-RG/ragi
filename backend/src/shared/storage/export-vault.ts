import { db } from "../db.js";
import { withOwnerVault } from "../vault.js";

/** Full owner vault dump (decrypted for the sealed session). Used for retrieval + snapshots. */
export async function exportVault(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const [
    mode,
    jobs,
    notes,
    focus,
    projects,
    goals,
    activities,
    finance,
    meetings,
    reminders,
    emergencies,
  ] = await Promise.all([
    db.modeState.findUnique({ where: { ownerId } }),
    db.jobEntry.findMany({ where: { ownerId } }),
    db.secureNote.findMany({ where: { ownerId } }),
    db.focusBlock.findMany({ where: { ownerId } }),
    db.project.findMany({ where: { ownerId } }),
    db.goal.findMany({ where: { ownerId } }),
    db.activity.findMany({ where: { ownerId } }),
    db.financeEntry.findMany({ where: { ownerId } }),
    db.meeting.findMany({ where: { ownerId } }),
    db.reminder.findMany({ where: { ownerId } }),
    db.emergency.findMany({ where: { ownerId } }),
  ]);

  return {
    format: "ragi-vault-v1" as const,
    exportedAt: new Date().toISOString(),
    ownerId,
    mode: mode?.mode ?? "work",
    jobs: jobs.map((r) => ({
      title: dec(r.titleEnc),
      company: r.companyEnc ? dec(r.companyEnc) : null,
      status: r.status,
      url: r.urlEnc ? dec(r.urlEnc) : null,
      notes: r.notesEnc ? dec(r.notesEnc) : null,
    })),
    notes: notes.map((r) => ({
      kind: r.kind,
      title: dec(r.titleEnc),
      body: dec(r.bodyEnc),
    })),
    focus: focus.map((r) => ({
      label: dec(r.labelEnc),
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      completed: r.completed,
    })),
    projects: projects.map((p) => ({
      title: dec(p.titleEnc),
      notes: p.notesEnc ? dec(p.notesEnc) : "",
      realm: p.realm,
      status: p.status,
      progress: p.progress,
      dueAt: p.dueAt?.toISOString() ?? null,
    })),
    goals: goals.map((g) => ({
      title: dec(g.titleEnc),
      realm: g.realm,
      status: g.status,
      progress: g.progress,
      target: g.targetEnc ? dec(g.targetEnc) : "",
    })),
    activities: activities.map((a) => ({
      title: dec(a.titleEnc),
      kind: a.kind,
      day: a.day.toISOString(),
      done: a.done,
    })),
    finance: finance.map((f) => ({
      kind: f.kind,
      amountCents: f.amountCents,
      label: dec(f.labelEnc),
      category: f.categoryEnc ? dec(f.categoryEnc) : "",
      at: f.at.toISOString(),
    })),
    meetings: meetings.map((m) => ({
      title: dec(m.titleEnc),
      place: m.placeEnc ? dec(m.placeEnc) : "",
      startsAt: m.startsAt.toISOString(),
      endsAt: m.endsAt.toISOString(),
      status: m.status,
    })),
    reminders: reminders.map((r) => ({
      title: dec(r.titleEnc),
      dueAt: r.dueAt.toISOString(),
      priority: r.priority,
      done: r.done,
    })),
    emergencies: emergencies.map((e) => ({
      title: dec(e.titleEnc),
      body: dec(e.bodyEnc),
      severity: e.severity,
      active: e.active,
    })),
    counts: {
      jobs: jobs.length,
      notes: notes.length,
      focus: focus.length,
      projects: projects.length,
      goals: goals.length,
      activities: activities.length,
      finance: finance.length,
      meetings: meetings.length,
      reminders: reminders.length,
      emergencies: emergencies.length,
    },
  };
}

export type VaultExport = Awaited<ReturnType<typeof exportVault>>;
