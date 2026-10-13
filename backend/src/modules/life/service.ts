import { db } from "../../shared/db.js";
import { withOwnerVault } from "../../shared/vault.js";
import { notFound } from "../../shared/errors.js";
import { touchVault } from "../../shared/storage/persist.js";
import { createSnapshot } from "../../shared/storage/snapshots.js";

export async function listProjects(ownerId: string, realm?: string) {
  const { dec } = await withOwnerVault(ownerId);
  const rows = await db.project.findMany({
    where: { ownerId, archived: false, ...(realm ? { realm } : {}) },
    orderBy: { updatedAt: "desc" },
  });
  return {
    projects: rows.map((p) => ({
      id: p.id,
      title: dec(p.titleEnc),
      notes: p.notesEnc ? dec(p.notesEnc) : "",
      realm: p.realm,
      status: p.status,
      progress: p.progress,
      dueAt: p.dueAt,
      archived: p.archived,
    })),
  };
}

export async function createProject(
  ownerId: string,
  input: {
    title: string;
    notes?: string;
    realm: string;
    status?: string;
    progress?: number;
    dueAt?: string;
  },
) {
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.project.create({
    data: {
      ownerId,
      titleEnc: enc(input.title),
      notesEnc: input.notes ? enc(input.notes) : null,
      realm: input.realm,
      status: input.status ?? "active",
      progress: Math.min(100, Math.max(0, input.progress ?? 0)),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    },
  });
  touchVault(ownerId, "project");
  return { id: row.id, progress: row.progress };
}

export async function updateProject(
  ownerId: string,
  id: string,
  input: Partial<{
    title: string;
    notes: string;
    realm: string;
    status: string;
    progress: number;
    dueAt: string | null;
  }>,
) {
  const existing = await db.project.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("project_not_found");
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.project.update({
    where: { id },
    data: {
      titleEnc: input.title !== undefined ? enc(input.title) : undefined,
      notesEnc: input.notes !== undefined ? enc(input.notes) : undefined,
      realm: input.realm,
      status: input.status,
      progress:
        input.progress !== undefined
          ? Math.min(100, Math.max(0, input.progress))
          : undefined,
      dueAt:
        input.dueAt === undefined
          ? undefined
          : input.dueAt
            ? new Date(input.dueAt)
            : null,
    },
  });
  touchVault(ownerId, "project");
  return { id: row.id, progress: row.progress, status: row.status };
}

export async function listGoals(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const rows = await db.goal.findMany({
    where: { ownerId, archived: false },
    orderBy: { updatedAt: "desc" },
  });
  return {
    goals: rows.map((g) => ({
      id: g.id,
      title: dec(g.titleEnc),
      realm: g.realm,
      status: g.status,
      progress: g.progress,
      target: g.targetEnc ? dec(g.targetEnc) : "",
    })),
  };
}

export async function createGoal(
  ownerId: string,
  input: { title: string; realm: string; progress?: number; target?: string },
) {
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.goal.create({
    data: {
      ownerId,
      titleEnc: enc(input.title),
      realm: input.realm,
      progress: Math.min(100, Math.max(0, input.progress ?? 0)),
      targetEnc: input.target ? enc(input.target) : null,
    },
  });
  touchVault(ownerId, "goal");
  return { id: row.id };
}

export async function updateGoal(
  ownerId: string,
  id: string,
  input: Partial<{ title: string; progress: number; status: string; target: string }>,
) {
  const existing = await db.goal.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("goal_not_found");
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.goal.update({
    where: { id },
    data: {
      titleEnc: input.title !== undefined ? enc(input.title) : undefined,
      progress:
        input.progress !== undefined
          ? Math.min(100, Math.max(0, input.progress))
          : undefined,
      status: input.status,
      targetEnc: input.target !== undefined ? enc(input.target) : undefined,
    },
  });
  touchVault(ownerId, "goal");
  return { id: row.id, progress: row.progress };
}

export async function listActivities(ownerId: string, day?: string) {
  const { dec } = await withOwnerVault(ownerId);
  const base = day ? new Date(day) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  const rows = await db.activity.findMany({
    where: { ownerId, archived: false, day: { gte: start, lte: end } },
    orderBy: { createdAt: "asc" },
  });
  return {
    activities: rows.map((a) => ({
      id: a.id,
      title: dec(a.titleEnc),
      kind: a.kind,
      day: a.day,
      done: a.done,
    })),
  };
}

export async function createActivity(
  ownerId: string,
  input: { title: string; kind?: string; day?: string },
) {
  const { enc } = await withOwnerVault(ownerId);
  const day = input.day ? new Date(input.day) : new Date();
  day.setHours(12, 0, 0, 0);
  const row = await db.activity.create({
    data: {
      ownerId,
      titleEnc: enc(input.title),
      kind: input.kind ?? "task",
      day,
    },
  });
  touchVault(ownerId, "activity");
  return { id: row.id };
}

export async function toggleActivity(ownerId: string, id: string) {
  const existing = await db.activity.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("activity_not_found");
  const row = await db.activity.update({
    where: { id },
    data: { done: !existing.done },
  });
  touchVault(ownerId, "activity");
  return { id: row.id, done: row.done };
}

export async function listFinance(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const rows = await db.financeEntry.findMany({
    where: { ownerId, archived: false },
    orderBy: { at: "desc" },
    take: 100,
  });
  let incomeCents = 0;
  let expenseCents = 0;
  for (const f of rows) {
    if (f.kind === "income") incomeCents += f.amountCents;
    if (f.kind === "expense") expenseCents += f.amountCents;
  }
  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    entries: rows.map((f) => ({
      id: f.id,
      kind: f.kind,
      amountCents: f.amountCents,
      label: dec(f.labelEnc),
      category: f.categoryEnc ? dec(f.categoryEnc) : "",
      at: f.at,
    })),
  };
}

export async function createFinance(
  ownerId: string,
  input: { kind: "income" | "expense" | "budget"; amount: number; label: string; category?: string; at?: string },
) {
  const { enc } = await withOwnerVault(ownerId);
  const amountCents = Math.round(Math.abs(input.amount) * 100);
  const row = await db.financeEntry.create({
    data: {
      ownerId,
      kind: input.kind,
      amountCents,
      labelEnc: enc(input.label),
      categoryEnc: input.category ? enc(input.category) : null,
      at: input.at ? new Date(input.at) : new Date(),
    },
  });
  touchVault(ownerId, "finance");
  return { id: row.id, amountCents: row.amountCents };
}

export async function listMeetings(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const rows = await db.meeting.findMany({
    where: { ownerId, archived: false },
    orderBy: { startsAt: "asc" },
    take: 50,
  });
  return {
    meetings: rows.map((m) => ({
      id: m.id,
      title: dec(m.titleEnc),
      place: m.placeEnc ? dec(m.placeEnc) : "",
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      status: m.status,
    })),
  };
}

export async function createMeeting(
  ownerId: string,
  input: { title: string; place?: string; startsAt: string; endsAt: string },
) {
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.meeting.create({
    data: {
      ownerId,
      titleEnc: enc(input.title),
      placeEnc: input.place ? enc(input.place) : null,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    },
  });
  touchVault(ownerId, "meeting");
  return { id: row.id };
}

export async function listReminders(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const rows = await db.reminder.findMany({
    where: { ownerId, archived: false },
    orderBy: { dueAt: "asc" },
    take: 50,
  });
  return {
    reminders: rows.map((r) => ({
      id: r.id,
      title: dec(r.titleEnc),
      dueAt: r.dueAt,
      priority: r.priority,
      done: r.done,
    })),
  };
}

export async function createReminder(
  ownerId: string,
  input: { title: string; dueAt: string; priority?: string },
) {
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.reminder.create({
    data: {
      ownerId,
      titleEnc: enc(input.title),
      dueAt: new Date(input.dueAt),
      priority: input.priority ?? "normal",
    },
  });
  touchVault(ownerId, "reminder");
  return { id: row.id };
}

export async function completeReminder(ownerId: string, id: string) {
  const existing = await db.reminder.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("reminder_not_found");
  await db.reminder.update({ where: { id }, data: { done: true } });
  touchVault(ownerId, "reminder");
  return { ok: true as const };
}

export async function listEmergencies(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const rows = await db.emergency.findMany({
    where: { ownerId, archived: false },
    orderBy: { updatedAt: "desc" },
  });
  return {
    emergencies: rows.map((e) => ({
      id: e.id,
      title: dec(e.titleEnc),
      body: dec(e.bodyEnc),
      severity: e.severity,
      active: e.active,
    })),
  };
}

export async function createEmergency(
  ownerId: string,
  input: { title: string; body: string; severity?: string },
) {
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.emergency.create({
    data: {
      ownerId,
      titleEnc: enc(input.title),
      bodyEnc: enc(input.body),
      severity: input.severity ?? "high",
    },
  });
  touchVault(ownerId, "emergency");
  return { id: row.id };
}

export async function resolveEmergency(ownerId: string, id: string) {
  const existing = await db.emergency.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("emergency_not_found");
  await db.emergency.update({ where: { id }, data: { active: false } });
  touchVault(ownerId, "emergency");
  return { ok: true as const };
}

/** Soft-delete: snapshot first, then archive. Rows stay in DB forever. */
async function archiveRow(
  ownerId: string,
  kind: string,
  id: string,
  finder: () => Promise<{ id: string } | null>,
  archiver: () => Promise<unknown>,
) {
  const existing = await finder();
  if (!existing) throw notFound(`${kind}_not_found`);
  await createSnapshot(ownerId, `pre-archive-${kind}`);
  await archiver();
  touchVault(ownerId, `archive-${kind}`);
  return { ok: true as const, archived: true, id, durable: true };
}

export async function archiveProject(ownerId: string, id: string) {
  return archiveRow(
    ownerId,
    "project",
    id,
    () => db.project.findFirst({ where: { id, ownerId } }),
    () => db.project.update({ where: { id }, data: { archived: true } }),
  );
}

export async function restoreProject(ownerId: string, id: string) {
  const existing = await db.project.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("project_not_found");
  await db.project.update({ where: { id }, data: { archived: false } });
  touchVault(ownerId, "project-restore");
  return { ok: true as const, id };
}

export async function archiveGoal(ownerId: string, id: string) {
  return archiveRow(
    ownerId,
    "goal",
    id,
    () => db.goal.findFirst({ where: { id, ownerId } }),
    () => db.goal.update({ where: { id }, data: { archived: true } }),
  );
}

export async function archiveActivity(ownerId: string, id: string) {
  return archiveRow(
    ownerId,
    "activity",
    id,
    () => db.activity.findFirst({ where: { id, ownerId } }),
    () => db.activity.update({ where: { id }, data: { archived: true } }),
  );
}

export async function updateActivity(
  ownerId: string,
  id: string,
  input: Partial<{ title: string; kind: string; done: boolean }>,
) {
  const existing = await db.activity.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("activity_not_found");
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.activity.update({
    where: { id },
    data: {
      titleEnc: input.title !== undefined ? enc(input.title) : undefined,
      kind: input.kind,
      done: input.done,
    },
  });
  touchVault(ownerId, "activity");
  return { id: row.id, done: row.done };
}

export async function updateFinance(
  ownerId: string,
  id: string,
  input: Partial<{ kind: string; amount: number; label: string; category: string }>,
) {
  const existing = await db.financeEntry.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("finance_not_found");
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.financeEntry.update({
    where: { id },
    data: {
      kind: input.kind,
      amountCents:
        input.amount !== undefined ? Math.round(Math.abs(input.amount) * 100) : undefined,
      labelEnc: input.label !== undefined ? enc(input.label) : undefined,
      categoryEnc: input.category !== undefined ? enc(input.category) : undefined,
    },
  });
  touchVault(ownerId, "finance");
  return { id: row.id };
}

export async function archiveFinance(ownerId: string, id: string) {
  return archiveRow(
    ownerId,
    "finance",
    id,
    () => db.financeEntry.findFirst({ where: { id, ownerId } }),
    () => db.financeEntry.update({ where: { id }, data: { archived: true } }),
  );
}

export async function updateMeeting(
  ownerId: string,
  id: string,
  input: Partial<{ title: string; place: string; startsAt: string; endsAt: string; status: string }>,
) {
  const existing = await db.meeting.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("meeting_not_found");
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.meeting.update({
    where: { id },
    data: {
      titleEnc: input.title !== undefined ? enc(input.title) : undefined,
      placeEnc: input.place !== undefined ? enc(input.place) : undefined,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      status: input.status,
    },
  });
  touchVault(ownerId, "meeting");
  return { id: row.id };
}

export async function archiveMeeting(ownerId: string, id: string) {
  return archiveRow(
    ownerId,
    "meeting",
    id,
    () => db.meeting.findFirst({ where: { id, ownerId } }),
    () => db.meeting.update({ where: { id }, data: { archived: true } }),
  );
}

export async function updateReminder(
  ownerId: string,
  id: string,
  input: Partial<{ title: string; dueAt: string; priority: string; done: boolean }>,
) {
  const existing = await db.reminder.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("reminder_not_found");
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.reminder.update({
    where: { id },
    data: {
      titleEnc: input.title !== undefined ? enc(input.title) : undefined,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
      priority: input.priority,
      done: input.done,
    },
  });
  touchVault(ownerId, "reminder");
  return { id: row.id };
}

export async function archiveReminder(ownerId: string, id: string) {
  return archiveRow(
    ownerId,
    "reminder",
    id,
    () => db.reminder.findFirst({ where: { id, ownerId } }),
    () => db.reminder.update({ where: { id }, data: { archived: true } }),
  );
}

export async function updateEmergency(
  ownerId: string,
  id: string,
  input: Partial<{ title: string; body: string; severity: string; active: boolean }>,
) {
  const existing = await db.emergency.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("emergency_not_found");
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.emergency.update({
    where: { id },
    data: {
      titleEnc: input.title !== undefined ? enc(input.title) : undefined,
      bodyEnc: input.body !== undefined ? enc(input.body) : undefined,
      severity: input.severity,
      active: input.active,
    },
  });
  touchVault(ownerId, "emergency");
  return { id: row.id };
}

export async function archiveEmergency(ownerId: string, id: string) {
  return archiveRow(
    ownerId,
    "emergency",
    id,
    () => db.emergency.findFirst({ where: { id, ownerId } }),
    () => db.emergency.update({ where: { id }, data: { archived: true } }),
  );
}

export async function updateNote(
  ownerId: string,
  id: string,
  input: Partial<{ title: string; body: string; kind: string }>,
) {
  const existing = await db.secureNote.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("note_not_found");
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.secureNote.update({
    where: { id },
    data: {
      titleEnc: input.title !== undefined ? enc(input.title) : undefined,
      bodyEnc: input.body !== undefined ? enc(input.body) : undefined,
      kind: input.kind,
    },
  });
  touchVault(ownerId, "note");
  return { id: row.id };
}

export async function archiveNote(ownerId: string, id: string) {
  return archiveRow(
    ownerId,
    "note",
    id,
    () => db.secureNote.findFirst({ where: { id, ownerId } }),
    () => db.secureNote.update({ where: { id }, data: { archived: true } }),
  );
}

export async function archiveJob(ownerId: string, id: string) {
  return archiveRow(
    ownerId,
    "job",
    id,
    () => db.jobEntry.findFirst({ where: { id, ownerId } }),
    () => db.jobEntry.update({ where: { id }, data: { archived: true } }),
  );
}
