import { db } from "../../shared/db.js";
import { withOwnerVault } from "../../shared/vault.js";
import { notFound } from "../../shared/errors.js";
import { touchVault } from "../../shared/storage/persist.js";
import { exportVault } from "../../shared/storage/export-vault.js";

export type JobStatus = "watch" | "draft" | "applied" | "interview" | "offer" | "closed";

export async function getMode(ownerId: string) {
  const row = await db.modeState.findUnique({ where: { ownerId } });
  return { mode: row?.mode ?? "work" };
}

export async function setMode(ownerId: string, mode: "work" | "personal") {
  const row = await db.modeState.upsert({
    where: { ownerId },
    create: { ownerId, mode },
    update: { mode },
  });
  touchVault(ownerId, "mode");
  return { mode: row.mode };
}

export async function getBriefing(ownerId: string) {
  const { enc, dec } = await withOwnerVault(ownerId);

  const jobs = await db.jobEntry.count({ where: { ownerId } });
  const focus = await db.focusBlock.findFirst({
    where: { ownerId, completed: false, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });
  const mode = await db.modeState.findUnique({ where: { ownerId } });
  const [projects, goals, meetings, reminders, emergencies] = await Promise.all([
    db.project.count({ where: { ownerId, status: "active" } }),
    db.goal.count({ where: { ownerId, status: "active" } }),
    db.meeting.count({ where: { ownerId, startsAt: { gte: new Date() }, status: { not: "cancelled" } } }),
    db.reminder.count({ where: { ownerId, done: false } }),
    db.emergency.count({ where: { ownerId, active: true } }),
  ]);

  const briefing = {
    mode: mode?.mode ?? "work",
    openJobs: jobs,
    projects,
    goals,
    meetings,
    reminders,
    emergencies,
    nextFocus: focus
      ? { label: dec(focus.labelEnc), startsAt: focus.startsAt, endsAt: focus.endsAt }
      : null,
    summary: `Dawn scroll · mode ${mode?.mode ?? "work"} · ${projects} projects · ${goals} goals · ${meetings} meetings · ${reminders} reminders · ${emergencies} emergencies · ${jobs} quests · focus ${focus ? "locked" : "clear"}.`,
  };

  await db.briefingCache.upsert({
    where: { ownerId },
    create: { ownerId, payloadEnc: enc(JSON.stringify(briefing)) },
    update: { payloadEnc: enc(JSON.stringify(briefing)), generatedAt: new Date() },
  });

  return { source: "live" as const, generatedAt: new Date().toISOString(), briefing };
}

export async function listJobs(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const rows = await db.jobEntry.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" } });
  return {
    jobs: rows.map((r) => ({
      id: r.id,
      title: dec(r.titleEnc),
      company: r.companyEnc ? dec(r.companyEnc) : null,
      status: r.status,
      url: r.urlEnc ? dec(r.urlEnc) : null,
      notes: r.notesEnc ? dec(r.notesEnc) : null,
      updatedAt: r.updatedAt,
    })),
  };
}

export async function createJob(
  ownerId: string,
  input: { title: string; company?: string; status: JobStatus; url?: string; notes?: string },
) {
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.jobEntry.create({
    data: {
      ownerId,
      titleEnc: enc(input.title),
      companyEnc: input.company ? enc(input.company) : null,
      status: input.status,
      urlEnc: input.url ? enc(input.url) : null,
      notesEnc: input.notes ? enc(input.notes) : null,
    },
  });
  touchVault(ownerId, "job");
  return { id: row.id, status: row.status };
}

export async function updateJob(
  ownerId: string,
  id: string,
  input: Partial<{ title: string; company: string; status: JobStatus; url: string; notes: string }>,
) {
  const existing = await db.jobEntry.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("job_not_found");
  const { enc } = await withOwnerVault(ownerId);
  const data: {
    titleEnc?: string;
    companyEnc?: string | null;
    status?: string;
    urlEnc?: string | null;
    notesEnc?: string | null;
  } = {};
  if (input.title) data.titleEnc = enc(input.title);
  if (input.company !== undefined) data.companyEnc = input.company ? enc(input.company) : null;
  if (input.status) data.status = input.status;
  if (input.url !== undefined) data.urlEnc = input.url ? enc(input.url) : null;
  if (input.notes !== undefined) data.notesEnc = input.notes ? enc(input.notes) : null;
  const row = await db.jobEntry.update({ where: { id }, data });
  touchVault(ownerId, "job");
  return { id: row.id, status: row.status };
}

export async function listFocus(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const rows = await db.focusBlock.findMany({
    where: { ownerId },
    orderBy: { startsAt: "desc" },
    take: 50,
  });
  return {
    blocks: rows.map((r) => ({
      id: r.id,
      label: dec(r.labelEnc),
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      completed: r.completed,
    })),
  };
}

export async function createFocus(
  ownerId: string,
  input: { label: string; startsAt: string; endsAt: string },
) {
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.focusBlock.create({
    data: {
      ownerId,
      labelEnc: enc(input.label),
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    },
  });
  touchVault(ownerId, "focus");
  return { id: row.id };
}

export async function completeFocus(ownerId: string, id: string) {
  const existing = await db.focusBlock.findFirst({ where: { id, ownerId } });
  if (!existing) throw notFound("focus_not_found");
  await db.focusBlock.update({ where: { id }, data: { completed: true } });
  touchVault(ownerId, "focus");
  return { ok: true as const };
}

export async function listNotes(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const rows = await db.secureNote.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" } });
  return {
    notes: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: dec(r.titleEnc),
      body: dec(r.bodyEnc),
      updatedAt: r.updatedAt,
    })),
  };
}

export async function createNote(
  ownerId: string,
  input: { kind: string; title: string; body: string },
) {
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.secureNote.create({
    data: {
      ownerId,
      kind: input.kind,
      titleEnc: enc(input.title),
      bodyEnc: enc(input.body),
    },
  });
  touchVault(ownerId, "note");
  return { id: row.id };
}

export async function exportAll(ownerId: string) {
  return exportVault(ownerId);
}
