export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "blocked" | "done";
export const STATUSES: { id: TaskStatus; label: string; tone: string }[] = [
  { id: "backlog", label: "Backlog", tone: "var(--arn-faint)" },
  { id: "todo", label: "To do", tone: "var(--arn-muted)" },
  { id: "in_progress", label: "In progress", tone: "var(--arn-accent)" },
  { id: "review", label: "In review", tone: "var(--arn-info)" },
  { id: "blocked", label: "Blocked", tone: "var(--arn-danger)" },
  { id: "done", label: "Done", tone: "var(--arn-positive)" },
];
export const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;
export type Priority = keyof typeof PRIORITY_ORDER;

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  project_name: string | null;
  status: TaskStatus;
  priority: Priority;
  assignee_kind: string;
  assignee_agent_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  is_demo: boolean;
  requires_approval: boolean;
}

export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const out = Object.fromEntries(STATUSES.map((s) => [s.id, [] as Task[]])) as Record<TaskStatus, Task[]>;
  for (const t of tasks) (out[t.status] ?? out.todo).push(t);
  for (const k of Object.keys(out) as TaskStatus[]) {
    out[k].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.title.localeCompare(b.title));
  }
  return out;
}

export function filterTasks(tasks: Task[], f: { q?: string; projectId?: string; priority?: Priority | "" }): Task[] {
  const q = f.q?.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (!q || t.title.toLowerCase().includes(q) || (t.project_name ?? "").toLowerCase().includes(q)) &&
      (!f.projectId || t.project_id === f.projectId) &&
      (!f.priority || t.priority === f.priority),
  );
}

/** Next status for the "advance" shortcut (]), skipping blocked. */
export function nextStatus(s: TaskStatus): TaskStatus {
  const flow: TaskStatus[] = ["backlog", "todo", "in_progress", "review", "done"];
  const i = flow.indexOf(s);
  return i === -1 ? "todo" : flow[Math.min(i + 1, flow.length - 1)];
}

export function prevStatus(s: TaskStatus): TaskStatus {
  const flow: TaskStatus[] = ["backlog", "todo", "in_progress", "review", "done"];
  const i = flow.indexOf(s);
  return i === -1 ? "todo" : flow[Math.max(i - 1, 0)];
}

/** Keyboard selection movement in a flat list (j/k). */
export function moveSelection(ids: string[], current: string | null, delta: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const i = current ? ids.indexOf(current) : -1;
  if (i === -1) return delta === 1 ? ids[0] : ids[ids.length - 1];
  return ids[Math.max(0, Math.min(ids.length - 1, i + delta))];
}
