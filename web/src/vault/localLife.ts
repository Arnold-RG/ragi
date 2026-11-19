/**
 * Device-local life board (IndexedDB). Used when the session is a local vault token.
 */

import { isLocalToken, readLocalSession } from "./localAuth";
import { getToken } from "../state/session";
import type { Dashboard } from "../api/life";
import type { GhProject, GithubReposResponse } from "../api/github";
import { analyzeGithub, clearGithubIntelCache } from "./githubIntel";

const DB_NAME = "ragi-life";
const DB_VERSION = 1;
const STORE = "boards";

type Project = Dashboard["projects"][number];
type Goal = Dashboard["goals"][number];
type Activity = Dashboard["activitiesToday"][number] & { day: string; archived?: boolean };
type Finance = Dashboard["finance"]["recent"][number] & { category?: string; archived?: boolean };
type Meeting = Dashboard["meetingsUpcoming"][number] & { archived?: boolean };
type Reminder = Dashboard["reminders"][number] & { archived?: boolean };
type Emergency = Dashboard["emergencies"][number] & { archived?: boolean };
type Note = { id: string; kind: string; title: string; body: string; updatedAt: string; archived?: boolean };

export type LifeBoard = {
  accountId: string;
  projects: Project[];
  goals: Goal[];
  activities: Activity[];
  finance: Finance[];
  meetings: Meeting[];
  reminders: Reminder[];
  emergencies: Emergency[];
  notes: Note[];
  githubLogin: string | null;
  githubProgress: Record<string, number>;
  updatedAt: string;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function id() {
  return `l_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "accountId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("life_open_failed"));
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("life_req_failed"));
  });
}

function emptyBoard(accountId: string): LifeBoard {
  return {
    accountId,
    projects: [],
    goals: [],
    activities: [],
    finance: [],
    meetings: [],
    reminders: [],
    emergencies: [],
    notes: [],
    githubLogin: null,
    githubProgress: {},
    updatedAt: new Date().toISOString(),
  };
}

async function accountId(): Promise<string> {
  const token = getToken();
  if (!isLocalToken(token)) throw new Error("Not a local session.");
  const session = await readLocalSession(token);
  if (!session) throw new Error("Sign in to open this room.");
  return session.accountId;
}

async function load(): Promise<LifeBoard> {
  const aid = await accountId();
  const db = await openDb();
  const row = await idbReq<LifeBoard | undefined>(
    db.transaction(STORE, "readonly").objectStore(STORE).get(aid),
  );
  return row ?? emptyBoard(aid);
}

async function save(board: LifeBoard): Promise<LifeBoard> {
  board.updatedAt = new Date().toISOString();
  const db = await openDb();
  await idbReq(db.transaction(STORE, "readwrite").objectStore(STORE).put(board));
  return board;
}

function buildCharts(board: LifeBoard): Dashboard["charts"] {
  const activeProjects = board.projects.filter((p) => p.status !== "archived");
  const activeGoals = board.goals.filter((g) => g.status !== "archived");
  const projectAvg = activeProjects.length
    ? Math.round(activeProjects.reduce((s, p) => s + p.progress, 0) / activeProjects.length)
    : 0;
  const goalAvg = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
    : 0;
  const speedBars = activeProjects.slice(0, 8).map((p) => ({
    label: p.title,
    value: p.progress,
    realm: p.realm,
  }));
  const direction =
    projectAvg >= 60 ? "forward" : projectAvg >= 30 ? "steady" : activeProjects.length ? "stalled" : "steady";

  const entries = [...board.finance]
    .filter((e) => !e.archived)
    .sort((a, b) => a.at.localeCompare(b.at));
  let bal = 0;
  const cashSeries = entries.slice(-12).map((e) => {
    if (e.kind === "income") bal += e.amountCents;
    else if (e.kind === "expense") bal -= e.amountCents;
    return { label: new Date(e.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), balance: bal };
  });

  return {
    projectAvgProgress: projectAvg,
    goalAvgProgress: goalAvg,
    speedBars,
    direction,
    cashSeries,
  };
}

function financeTotals(board: LifeBoard) {
  let income = 0;
  let expense = 0;
  const recent = board.finance
    .filter((e) => !e.archived)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 20);
  for (const e of board.finance.filter((x) => !x.archived)) {
    if (e.kind === "income") income += e.amountCents;
    if (e.kind === "expense") expense += e.amountCents;
  }
  return { incomeCents: income, expenseCents: expense, balanceCents: income - expense, recent };
}

export async function localGetDashboard(): Promise<Dashboard> {
  const board = await load();
  const day = todayKey();
  const activitiesToday = board.activities.filter((a) => !a.archived && a.day === day);
  const meetingsUpcoming = board.meetings
    .filter((m) => !m.archived && new Date(m.endsAt).getTime() >= Date.now())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 12);
  const reminders = board.reminders
    .filter((r) => !r.archived && !r.done)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 20);
  const emergencies = board.emergencies.filter((e) => !e.archived).slice(0, 20);
  const projects = board.projects.filter((p) => p.status !== "archived");
  const goals = board.goals.filter((g) => g.status !== "archived");

  return {
    mode: "local",
    generatedAt: new Date().toISOString(),
    openJobs: 0,
    focusActive: null,
    projects,
    goals,
    activitiesToday,
    finance: financeTotals(board),
    meetingsUpcoming,
    reminders,
    emergencies,
    charts: buildCharts(board),
  };
}

export async function localCreateProject(input: {
  title: string;
  notes?: string;
  realm: "work" | "personal";
  progress?: number;
}) {
  const board = await load();
  const row: Project = {
    id: id(),
    title: input.title,
    notes: input.notes ?? "",
    realm: input.realm,
    status: "active",
    progress: Math.max(0, Math.min(100, Math.round(input.progress ?? 0))),
    dueAt: null,
  };
  board.projects.unshift(row);
  await save(board);
  return { id: row.id };
}

export async function localPatchProject(
  projectId: string,
  input: { title?: string; notes?: string; progress?: number; status?: string; realm?: string },
) {
  const board = await load();
  const row = board.projects.find((p) => p.id === projectId);
  if (!row) throw new Error("Project not found.");
  if (input.title !== undefined) row.title = input.title;
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.progress !== undefined) row.progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  if (input.status !== undefined) row.status = input.status;
  if (input.realm !== undefined) row.realm = input.realm;
  await save(board);
  return { id: row.id };
}

export async function localDeleteProject(projectId: string) {
  const board = await load();
  const row = board.projects.find((p) => p.id === projectId);
  if (row) row.status = "archived";
  await save(board);
  return { ok: true, archived: true };
}

export async function localCreateGoal(input: {
  title: string;
  realm: "work" | "personal";
  progress?: number;
  target?: string;
}) {
  const board = await load();
  const row: Goal = {
    id: id(),
    title: input.title,
    realm: input.realm,
    status: "active",
    progress: Math.max(0, Math.min(100, Math.round(input.progress ?? 0))),
    target: input.target ?? "",
  };
  board.goals.unshift(row);
  await save(board);
  return { id: row.id };
}

export async function localPatchGoal(
  goalId: string,
  input: { title?: string; progress?: number; status?: string; target?: string },
) {
  const board = await load();
  const row = board.goals.find((g) => g.id === goalId);
  if (!row) throw new Error("Goal not found.");
  if (input.title !== undefined) row.title = input.title;
  if (input.progress !== undefined) row.progress = Math.max(0, Math.min(100, Math.round(input.progress)));
  if (input.status !== undefined) row.status = input.status;
  if (input.target !== undefined) row.target = input.target;
  await save(board);
  return { id: row.id };
}

export async function localDeleteGoal(goalId: string) {
  const board = await load();
  const row = board.goals.find((g) => g.id === goalId);
  if (row) row.status = "archived";
  await save(board);
  return { ok: true };
}

export async function localCreateActivity(input: { title: string; kind?: string }) {
  const board = await load();
  const row: Activity = {
    id: id(),
    title: input.title,
    kind: input.kind ?? "task",
    done: false,
    day: todayKey(),
  };
  board.activities.unshift(row);
  await save(board);
  return { id: row.id };
}

export async function localToggleActivity(activityId: string) {
  const board = await load();
  const row = board.activities.find((a) => a.id === activityId);
  if (!row) throw new Error("Task not found.");
  row.done = !row.done;
  await save(board);
  return { id: row.id, done: row.done };
}

export async function localDeleteActivity(activityId: string) {
  const board = await load();
  const row = board.activities.find((a) => a.id === activityId);
  if (row) row.archived = true;
  await save(board);
  return { ok: true };
}

export async function localPatchActivity(activityId: string, input: { title?: string; done?: boolean }) {
  const board = await load();
  const row = board.activities.find((a) => a.id === activityId);
  if (!row) throw new Error("Task not found.");
  if (input.title !== undefined) row.title = input.title;
  if (input.done !== undefined) row.done = input.done;
  await save(board);
  return { id: row.id };
}

export async function localCreateFinance(input: {
  kind: "income" | "expense" | "budget";
  amount: number;
  label: string;
  category?: string;
}) {
  const board = await load();
  const row: Finance = {
    id: id(),
    kind: input.kind,
    amountCents: Math.round(input.amount * 100),
    label: input.label,
    category: input.category,
    at: new Date().toISOString(),
  };
  board.finance.unshift(row);
  await save(board);
  return { id: row.id };
}

export async function localPatchFinance(
  entryId: string,
  input: { label?: string; amount?: number; kind?: string; category?: string },
) {
  const board = await load();
  const row = board.finance.find((e) => e.id === entryId);
  if (!row) throw new Error("Entry not found.");
  if (input.label !== undefined) row.label = input.label;
  if (input.amount !== undefined) row.amountCents = Math.round(input.amount * 100);
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.category !== undefined) row.category = input.category;
  await save(board);
  return { id: row.id };
}

export async function localDeleteFinance(entryId: string) {
  const board = await load();
  const row = board.finance.find((e) => e.id === entryId);
  if (row) row.archived = true;
  await save(board);
  return { ok: true };
}

export async function localCreateMeeting(input: {
  title: string;
  place?: string;
  startsAt: string;
  endsAt: string;
}) {
  const board = await load();
  const row: Meeting = {
    id: id(),
    title: input.title,
    place: input.place ?? "",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  };
  board.meetings.unshift(row);
  await save(board);
  return { id: row.id };
}

export async function localDeleteMeeting(meetingId: string) {
  const board = await load();
  const row = board.meetings.find((m) => m.id === meetingId);
  if (row) row.archived = true;
  await save(board);
  return { ok: true };
}

export async function localCreateReminder(input: {
  title: string;
  dueAt: string;
  priority?: "low" | "normal" | "high";
}) {
  const board = await load();
  const row: Reminder = {
    id: id(),
    title: input.title,
    dueAt: input.dueAt,
    priority: input.priority ?? "normal",
    done: false,
  };
  board.reminders.unshift(row);
  await save(board);
  return { id: row.id };
}

export async function localCompleteReminder(reminderId: string) {
  const board = await load();
  const row = board.reminders.find((r) => r.id === reminderId);
  if (row) row.done = true;
  await save(board);
  return { ok: true };
}

export async function localDeleteReminder(reminderId: string) {
  const board = await load();
  const row = board.reminders.find((r) => r.id === reminderId);
  if (row) row.archived = true;
  await save(board);
  return { ok: true };
}

export async function localCreateEmergency(input: {
  title: string;
  body?: string;
  severity?: "low" | "high" | "critical";
}) {
  const board = await load();
  const row: Emergency = {
    id: id(),
    title: input.title,
    body: input.body ?? "",
    severity: input.severity ?? "high",
    active: true,
  };
  board.emergencies.unshift(row);
  await save(board);
  return { id: row.id };
}

export async function localResolveEmergency(emergencyId: string) {
  const board = await load();
  const row = board.emergencies.find((e) => e.id === emergencyId);
  if (row) row.active = false;
  await save(board);
  return { ok: true };
}

export async function localDeleteEmergency(emergencyId: string) {
  const board = await load();
  const row = board.emergencies.find((e) => e.id === emergencyId);
  if (row) row.archived = true;
  await save(board);
  return { ok: true };
}

export async function localListNotes() {
  const board = await load();
  return {
    notes: board.notes
      .filter((n) => !n.archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export async function localCreateNote(input: { kind?: string; title: string; body?: string }) {
  const board = await load();
  const row: Note = {
    id: id(),
    kind: input.kind ?? "note",
    title: input.title,
    body: input.body ?? "",
    updatedAt: new Date().toISOString(),
  };
  board.notes.unshift(row);
  await save(board);
  return { id: row.id };
}

export async function localPatchNote(noteId: string, input: { title?: string; body?: string }) {
  const board = await load();
  const row = board.notes.find((n) => n.id === noteId);
  if (!row) throw new Error("Note not found.");
  if (input.title !== undefined) row.title = input.title;
  if (input.body !== undefined) row.body = input.body;
  row.updatedAt = new Date().toISOString();
  await save(board);
  return { id: row.id };
}

export async function localDeleteNote(noteId: string) {
  const board = await load();
  const row = board.notes.find((n) => n.id === noteId);
  if (row) row.archived = true;
  await save(board);
  return { ok: true };
}

export async function localListGithubRepos(): Promise<GithubReposResponse> {
  const board = await load();
  if (!board.githubLogin) {
    return {
      login: "",
      fetchedAt: new Date().toISOString(),
      authenticated: false,
      needsLogin: true,
      count: 0,
      avgProgress: 0,
      avgRemaining: 100,
      projects: [] as GhProject[],
    };
  }

  const intel = await analyzeGithub(board.githubLogin, board.githubProgress);
  return {
    login: intel.login,
    fetchedAt: intel.fetchedAt,
    authenticated: false,
    needsLogin: false,
    count: intel.count,
    avgProgress: intel.avgProgress,
    avgRemaining: intel.avgRemaining,
    projects: intel.projects,
    intel,
  };
}

export async function localSetGithubLogin(login: string) {
  const board = await load();
  board.githubLogin = login.trim().replace(/^@/, "");
  clearGithubIntelCache();
  await save(board);
  return { login: board.githubLogin };
}

export async function localSetGithubProgress(fullName: string, progress: number) {
  const board = await load();
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  board.githubProgress[fullName] = p;
  clearGithubIntelCache(board.githubLogin ?? undefined);
  await save(board);
  return { fullName, progress: p, remaining: 100 - p };
}
