import { api } from "./client";

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

export function getDashboard() {
  return api<Dashboard>("/api/v1/dashboard");
}

export function createProject(input: {
  title: string;
  notes?: string;
  realm: "work" | "personal";
  progress?: number;
}) {
  return api<{ id: string }>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function patchProject(id: string, input: { progress?: number; status?: string }) {
  return api<{ id: string }>(`/api/v1/projects/${id}`, {
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
  return api<{ id: string }>("/api/v1/goals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createActivity(input: { title: string; kind?: string }) {
  return api<{ id: string }>("/api/v1/activities", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function toggleActivity(id: string) {
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
  return api<{ id: string }>("/api/v1/reminders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function completeReminder(id: string) {
  return api<{ ok: boolean }>(`/api/v1/reminders/${id}/complete`, { method: "POST" });
}

export function createEmergency(input: {
  title: string;
  body?: string;
  severity?: "low" | "high" | "critical";
}) {
  return api<{ id: string }>("/api/v1/emergencies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function resolveEmergency(id: string) {
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
