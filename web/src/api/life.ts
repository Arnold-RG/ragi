import { api } from "./client";
import { getToken } from "../state/session";
import { isLocalToken } from "../vault/localAuth";
import {
  localCompleteReminder,
  localCreateActivity,
  localCreateEmergency,
  localCreateFinance,
  localCreateGoal,
  localCreateMeeting,
  localCreateProject,
  localCreateReminder,
  localDeleteActivity,
  localDeleteEmergency,
  localDeleteFinance,
  localDeleteGoal,
  localDeleteMeeting,
  localDeleteNote,
  localDeleteProject,
  localDeleteReminder,
  localGetDashboard,
  localPatchActivity,
  localPatchFinance,
  localPatchGoal,
  localPatchNote,
  localPatchProject,
  localResolveEmergency,
  localToggleActivity,
} from "../vault/localLife";

export type Dashboard = {
  mode: string;
  generatedAt: string;
  openJobs: number;
  focusActive: { label: string; endsAt: string } | null;
  projects: Array<{
    id: string;
    title: string;
    notes: string;
    realm: string;
    status: string;
    progress: number;
    dueAt: string | null;
  }>;
  goals: Array<{
    id: string;
    title: string;
    realm: string;
    status: string;
    progress: number;
    target: string;
  }>;
  activitiesToday: Array<{ id: string; title: string; kind: string; done: boolean }>;
  finance: {
    incomeCents: number;
    expenseCents: number;
    balanceCents: number;
    recent: Array<{ id: string; kind: string; amountCents: number; label: string; at: string }>;
  };
  meetingsUpcoming: Array<{
    id: string;
    title: string;
    place: string;
    startsAt: string;
    endsAt: string;
  }>;
  reminders: Array<{ id: string; title: string; dueAt: string; priority: string; done: boolean }>;
  emergencies: Array<{
    id: string;
    title: string;
    body: string;
    severity: string;
    active: boolean;
  }>;
  charts: {
    projectAvgProgress: number;
    goalAvgProgress: number;
    speedBars: Array<{ label: string; value: number; realm: string }>;
    direction: string;
    cashSeries: Array<{ label: string; balance: number }>;
  };
};

function useLocal() {
  return isLocalToken(getToken());
}

export function getDashboard() {
  if (useLocal()) return localGetDashboard();
  return api<Dashboard>("/api/v1/dashboard");
}

export function createProject(input: {
  title: string;
  notes?: string;
  realm: "work" | "personal";
  progress?: number;
}) {
  if (useLocal()) return localCreateProject(input);
  return api<{ id: string }>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchProject(
  id: string,
  input: { title?: string; notes?: string; progress?: number; status?: string; realm?: string },
) {
  if (useLocal()) return localPatchProject(id, input);
  return api<{ id: string }>(`/api/v1/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProject(id: string) {
  if (useLocal()) return localDeleteProject(id);
  return api<{ ok: boolean; archived: boolean }>(`/api/v1/projects/${id}`, { method: "DELETE" });
}

export function patchGoal(
  id: string,
  input: { title?: string; progress?: number; status?: string; target?: string },
) {
  if (useLocal()) return localPatchGoal(id, input);
  return api<{ id: string }>(`/api/v1/goals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteGoal(id: string) {
  if (useLocal()) return localDeleteGoal(id);
  return api<{ ok: boolean }>(`/api/v1/goals/${id}`, { method: "DELETE" });
}

export function deleteActivity(id: string) {
  if (useLocal()) return localDeleteActivity(id);
  return api<{ ok: boolean }>(`/api/v1/activities/${id}`, { method: "DELETE" });
}

export function patchActivity(id: string, input: { title?: string; done?: boolean }) {
  if (useLocal()) return localPatchActivity(id, input);
  return api<{ id: string }>(`/api/v1/activities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteFinance(id: string) {
  if (useLocal()) return localDeleteFinance(id);
  return api<{ ok: boolean }>(`/api/v1/finance/${id}`, { method: "DELETE" });
}

export function patchFinance(
  id: string,
  input: { label?: string; amount?: number; kind?: string; category?: string },
) {
  if (useLocal()) return localPatchFinance(id, input);
  return api<{ id: string }>(`/api/v1/finance/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMeeting(id: string) {
  if (useLocal()) return localDeleteMeeting(id);
  return api<{ ok: boolean }>(`/api/v1/meetings/${id}`, { method: "DELETE" });
}

export function deleteReminder(id: string) {
  if (useLocal()) return localDeleteReminder(id);
  return api<{ ok: boolean }>(`/api/v1/reminders/${id}`, { method: "DELETE" });
}

export function deleteEmergency(id: string) {
  if (useLocal()) return localDeleteEmergency(id);
  return api<{ ok: boolean }>(`/api/v1/emergencies/${id}`, { method: "DELETE" });
}

export function deleteNote(id: string) {
  if (useLocal()) return localDeleteNote(id);
  return api<{ ok: boolean }>(`/api/v1/notes/${id}`, { method: "DELETE" });
}

export function patchNote(id: string, input: { title?: string; body?: string }) {
  if (useLocal()) return localPatchNote(id, input);
  return api<{ id: string }>(`/api/v1/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function createGoal(input: {
  title: string;
  realm: "work" | "personal";
  progress?: number;
  target?: string;
}) {
  if (useLocal()) return localCreateGoal(input);
  return api<{ id: string }>("/api/v1/goals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createActivity(input: { title: string; kind?: string }) {
  if (useLocal()) return localCreateActivity(input);
  return api<{ id: string }>("/api/v1/activities", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function toggleActivity(id: string) {
  if (useLocal()) return localToggleActivity(id);
  return api<{ id: string; done: boolean }>(`/api/v1/activities/${id}/toggle`, {
    method: "POST",
  });
}

export function createFinance(input: {
  kind: "income" | "expense" | "budget";
  amount: number;
  label: string;
  category?: string;
}) {
  if (useLocal()) return localCreateFinance(input);
  return api<{ id: string }>("/api/v1/finance", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createMeeting(input: {
  title: string;
  place?: string;
  startsAt: string;
  endsAt: string;
}) {
  if (useLocal()) return localCreateMeeting(input);
  return api<{ id: string }>("/api/v1/meetings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createReminder(input: {
  title: string;
  dueAt: string;
  priority?: "low" | "normal" | "high";
}) {
  if (useLocal()) return localCreateReminder(input);
  return api<{ id: string }>("/api/v1/reminders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function completeReminder(id: string) {
  if (useLocal()) return localCompleteReminder(id);
  return api<{ ok: boolean }>(`/api/v1/reminders/${id}/complete`, { method: "POST" });
}

export function createEmergency(input: {
  title: string;
  body?: string;
  severity?: "low" | "high" | "critical";
}) {
  if (useLocal()) return localCreateEmergency(input);
  return api<{ id: string }>("/api/v1/emergencies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function resolveEmergency(id: string) {
  if (useLocal()) return localResolveEmergency(id);
  return api<{ ok: boolean }>(`/api/v1/emergencies/${id}/resolve`, { method: "POST" });
}

export function money(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function localIsoFromInput(value: string) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
