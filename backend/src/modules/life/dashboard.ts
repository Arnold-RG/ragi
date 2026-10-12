import { db } from "../../shared/db.js";
import { withOwnerVault } from "../../shared/vault.js";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function getDashboard(ownerId: string) {
  const { dec } = await withOwnerVault(ownerId);
  const now = new Date();
  const day0 = startOfDay(now);
  const day1 = endOfDay(now);

  const [
    mode,
    projects,
    goals,
    activities,
    finance,
    meetings,
    reminders,
    emergencies,
    jobs,
    focus,
  ] = await Promise.all([
    db.modeState.findUnique({ where: { ownerId } }),
    db.project.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" }, take: 40 }),
    db.goal.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" }, take: 40 }),
    db.activity.findMany({
      where: { ownerId, day: { gte: day0, lte: day1 } },
      orderBy: { createdAt: "asc" },
    }),
    db.financeEntry.findMany({ where: { ownerId }, orderBy: { at: "desc" }, take: 200 }),
    db.meeting.findMany({
      where: { ownerId, startsAt: { gte: now }, status: { not: "cancelled" } },
      orderBy: { startsAt: "asc" },
      take: 20,
    }),
    db.reminder.findMany({
      where: { ownerId, done: false },
      orderBy: { dueAt: "asc" },
      take: 30,
    }),
    db.emergency.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" }, take: 20 }),
    db.jobEntry.count({ where: { ownerId, status: { not: "closed" } } }),
    db.focusBlock.findFirst({
      where: { ownerId, completed: false, endsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  let incomeCents = 0;
  let expenseCents = 0;
  for (const f of finance) {
    if (f.kind === "income") incomeCents += f.amountCents;
    else if (f.kind === "expense") expenseCents += f.amountCents;
  }

  const projectRows = projects.map((p) => ({
    id: p.id,
    title: dec(p.titleEnc),
    notes: p.notesEnc ? dec(p.notesEnc) : "",
    realm: p.realm,
    status: p.status,
    progress: p.progress,
    dueAt: p.dueAt,
  }));

  const goalRows = goals.map((g) => ({
    id: g.id,
    title: dec(g.titleEnc),
    realm: g.realm,
    status: g.status,
    progress: g.progress,
    target: g.targetEnc ? dec(g.targetEnc) : "",
  }));

  const avg =
    projectRows.length === 0
      ? 0
      : Math.round(projectRows.reduce((s, p) => s + p.progress, 0) / projectRows.length);

  const goalAvg =
    goalRows.length === 0
      ? 0
      : Math.round(goalRows.reduce((s, g) => s + g.progress, 0) / goalRows.length);

  const speedBars = projectRows.slice(0, 8).map((p) => ({
    label: p.title.slice(0, 18),
    value: p.progress,
    realm: p.realm,
  }));

  return {
    mode: mode?.mode ?? "work",
    generatedAt: now.toISOString(),
    openJobs: jobs,
    focusActive: focus
      ? { label: dec(focus.labelEnc), endsAt: focus.endsAt }
      : null,
    projects: projectRows,
    goals: goalRows,
    activitiesToday: activities.map((a) => ({
      id: a.id,
      title: dec(a.titleEnc),
      kind: a.kind,
      done: a.done,
      day: a.day,
    })),
    finance: {
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
      recent: finance.slice(0, 12).map((f) => ({
        id: f.id,
        kind: f.kind,
        amountCents: f.amountCents,
        label: dec(f.labelEnc),
        category: f.categoryEnc ? dec(f.categoryEnc) : "",
        at: f.at,
      })),
    },
    meetingsUpcoming: meetings.map((m) => ({
      id: m.id,
      title: dec(m.titleEnc),
      place: m.placeEnc ? dec(m.placeEnc) : "",
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      status: m.status,
    })),
    reminders: reminders.map((r) => ({
      id: r.id,
      title: dec(r.titleEnc),
      dueAt: r.dueAt,
      priority: r.priority,
      done: r.done,
    })),
    emergencies: emergencies.map((e) => ({
      id: e.id,
      title: dec(e.titleEnc),
      body: dec(e.bodyEnc),
      severity: e.severity,
      active: e.active,
    })),
    charts: {
      projectAvgProgress: avg,
      goalAvgProgress: goalAvg,
      speedBars,
      direction: avg >= 60 ? "forward" : avg >= 30 ? "steady" : "stall",
      cashSeries: finance
        .slice()
        .reverse()
        .reduce<{ label: string; balance: number }[]>((acc, f) => {
          const prev = acc.length ? acc[acc.length - 1].balance : 0;
          const next =
            f.kind === "income" ? prev + f.amountCents : f.kind === "expense" ? prev - f.amountCents : prev;
          acc.push({
            label: new Date(f.at).toLocaleDateString(),
            balance: next,
          });
          return acc;
        }, [])
        .slice(-14),
    },
  };
}
