"use client";
import clsx from "clsx";
import { Columns3, List, Plus, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Sheet } from "@/components/ui/Sheet";
import { DemoBadge, Empty, Skeleton } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/format";
import {
  filterTasks, groupByStatus, moveSelection, nextStatus, prevStatus, PRIORITY_ORDER, STATUSES,
  type Priority, type Task, type TaskStatus,
} from "@/lib/tasks";
import type { Project } from "@/lib/types";

const PRIORITY_TONE: Record<Priority, string> = {
  critical: "var(--arn-danger)", high: "var(--arn-warning)", medium: "var(--arn-muted)", low: "var(--arn-faint)",
};

function PriorityIcon({ p }: { p: Priority }) {
  const bars = 4 - PRIORITY_ORDER[p];
  return (
    <span className="inline-flex h-3.5 items-end gap-[2px]" title={`${p} priority`} aria-label={`${p} priority`}>
      {[1, 2, 3, 4].map((i) => <span key={i} className="w-[3px] rounded-sm" style={{ height: `${i * 25}%`, background: i <= bars ? PRIORITY_TONE[p] : "var(--arn-border-strong)" }} />)}
    </span>
  );
}

function StatusDot({ s }: { s: TaskStatus }) {
  const tone = STATUSES.find((x) => x.id === s)?.tone ?? "var(--arn-muted)";
  return <span className="inline-block h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: tone, background: s === "done" ? tone : s === "in_progress" ? `linear-gradient(90deg, ${tone} 50%, transparent 50%)` : "transparent" }} />;
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

export function TaskWorkspace({ projectId, compact = false }: { projectId?: string; compact?: boolean }) {
  const key = projectId ? `/tasks?project_id=${projectId}` : "/tasks";
  const { data: tasks, mutate } = useSWR<Task[]>(key, fetcher);
  const { data: projects } = useSWR<Project[]>(projectId ? null : "/projects", fetcher);
  const [view, setView] = useState<"list" | "board">(compact ? "list" : "board");
  const [q, setQ] = useState("");
  const [project, setProject] = useState("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => filterTasks(tasks ?? [], { q, projectId: project || undefined, priority }), [tasks, q, project, priority]);
  const grouped = useMemo(() => groupByStatus(visible), [visible]);
  const flatIds = useMemo(() => STATUSES.flatMap((s) => grouped[s.id].map((t) => t.id)), [grouped]);

  const update = useCallback(async (t: Task, patch: Partial<Task>) => {
    setError(null);
    const optimistic = (tasks ?? []).map((x) => (x.id === t.id ? { ...x, ...patch } : x));
    try {
      await mutate(async () => { await api(`/tasks/${t.id}`, { method: "PATCH", json: patch }); return optimistic; },
        { optimisticData: optimistic, rollbackOnError: true, revalidate: true });
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not update the task"); }
  }, [tasks, mutate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e) || open || creating) return;
      const cur = (tasks ?? []).find((t) => t.id === selected);
      if (e.key === "c") { e.preventDefault(); setCreating(true); }
      else if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => moveSelection(flatIds, s, 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => moveSelection(flatIds, s, -1)); }
      else if (e.key === "]" && cur) update(cur, { status: nextStatus(cur.status) });
      else if (e.key === "[" && cur) update(cur, { status: prevStatus(cur.status) });
      else if (e.key === "Enter" && cur) setOpen(cur);
      else if (e.key === "b") setView((v) => (v === "board" ? "list" : "board"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tasks, selected, flatIds, update, open, creating]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 md:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input ref={searchRef} className="input h-9 pl-9" placeholder="Filter tasks" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter tasks"
            onKeyDown={(e) => e.key === "Escape" && (e.currentTarget.blur(), setQ(""))} />
          <span className="kbd absolute right-2 top-1/2 -translate-y-1/2">/</span>
        </div>
        {!projectId && (
          <select className="input h-9 w-auto" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project filter">
            <option value="">All projects</option>
            {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <select className="input h-9 w-auto" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")} aria-label="Priority filter">
          <option value="">Any priority</option>
          {(["critical", "high", "medium", "low"] as Priority[]).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-line bg-surface-2/70 p-0.5">
          <button className={clsx("btn h-8 border-0 px-2.5", view === "list" ? "bg-surface-3" : "bg-transparent")} onClick={() => setView("list")} aria-pressed={view === "list"}><List size={15} /> List</button>
          <button className={clsx("btn h-8 border-0 px-2.5", view === "board" ? "bg-surface-3" : "bg-transparent")} onClick={() => setView("board")} aria-pressed={view === "board"}><Columns3 size={15} /> Board</button>
        </div>
        <button className="btn btn-primary h-9" onClick={() => setCreating(true)}><Plus size={15} /> New task <span className="kbd ml-1 hidden bg-black/10 md:inline">C</span></button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {!tasks ? <Skeleton className="h-64" /> : visible.length === 0 ? <Empty title="No tasks match">Press C to create one.</Empty> : view === "list" ? (
        <div className="card overflow-hidden">
          {STATUSES.map((s) => grouped[s.id].length > 0 && (
            <div key={s.id}>
              <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2 text-xs font-semibold">
                <StatusDot s={s.id} /> {s.label} <span className="num text-faint">{grouped[s.id].length}</span>
              </div>
              <ul>
                {grouped[s.id].map((t) => (
                  <li key={t.id} data-testid="task-row" data-selected={selected === t.id || undefined}
                    className={clsx("group grid cursor-pointer grid-cols-[auto_auto_1fr_auto] items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-b-0 hover:bg-surface-2/60",
                      selected === t.id && "bg-accent/10 shadow-[inset_2px_0_0_var(--arn-accent)]")}
                    onClick={() => { setSelected(t.id); setOpen(t); }}>
                    <PriorityIcon p={t.priority} />
                    <select className="cursor-pointer appearance-none bg-transparent text-xs text-muted outline-none" value={t.status} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => update(t, { status: e.target.value as TaskStatus })} aria-label={`Status of ${t.title}`}>
                      {STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                    <div className="min-w-0 truncate"><span className="font-medium">{t.title}</span> {t.project_name && !projectId && <span className="ml-2 text-xs text-faint">{t.project_name}</span>}</div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <DemoBadge show={t.is_demo} />
                      {t.assignee_kind === "agent" && <span className="chip">agent</span>}
                      <span className="hidden md:inline">{t.due_date ? formatDate(t.due_date) : ""}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {STATUSES.map((s) => (
            <div key={s.id} className="flex w-72 shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface-2/40 p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData("text/task"); const t = tasks.find((x) => x.id === id); if (t && t.status !== s.id) update(t, { status: s.id }); }}
              data-testid={`column-${s.id}`}>
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold"><StatusDot s={s.id} /> {s.label} <span className="num text-faint">{grouped[s.id].length}</span></div>
              <div className="flex min-h-16 flex-col gap-2">
                <AnimatePresence initial={false}>
                  {grouped[s.id].map((t) => (
                    <motion.div layout key={t.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                      <div draggable onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)} onClick={() => { setSelected(t.id); setOpen(t); }}
                        className={clsx("card cursor-grab p-3 text-sm active:cursor-grabbing", selected === t.id && "ring-2 ring-accent/60")}>
                        <div className="flex items-start gap-2"><PriorityIcon p={t.priority} /><span className="font-medium leading-snug">{t.title}</span></div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          {t.project_name && !projectId && <span className="truncate">{t.project_name}</span>}
                          <DemoBadge show={t.is_demo} />
                          {t.due_date && <span className="ml-auto">{formatDate(t.due_date)}</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
      {!compact && (
        <div className="mt-4 hidden flex-wrap gap-3 text-xs text-faint md:flex">
          <span><span className="kbd">C</span> new</span><span><span className="kbd">/</span> filter</span><span><span className="kbd">J</span>/<span className="kbd">K</span> move</span>
          <span><span className="kbd">[</span>/<span className="kbd">]</span> change status</span><span><span className="kbd">↵</span> open</span><span><span className="kbd">B</span> board/list</span>
        </div>
      )}
      <CreateTask open={creating} onClose={() => setCreating(false)} projectId={projectId} projects={projects} onCreated={() => mutate()} />
      <TaskDetail task={open} onClose={() => setOpen(null)} onChange={(p) => open && update(open, p).then(() => setOpen({ ...open, ...p } as Task))} />
    </div>
  );
}

function CreateTask({ open, onClose, projectId, projects, onCreated }: { open: boolean; onClose: () => void; projectId?: string; projects?: Project[]; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [pid, setPid] = useState(projectId ?? "");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try {
      await api("/tasks", { json: { title, project_id: pid || null, priority, status, due_date: due || null } });
      setTitle(""); setDue(""); onCreated(); onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not create the task"); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New task">
      <form onSubmit={submit} className="space-y-3">
        <input className="input h-11 text-base" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required minLength={2} aria-label="Task title" />
        <div className="grid grid-cols-2 gap-2">
          {!projectId && (
            <select className="input" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Project">
              <option value="">No project</option>
              {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} aria-label="Status">{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} aria-label="Priority">{(["critical", "high", "medium", "low"] as Priority[]).map((p) => <option key={p}>{p}</option>)}</select>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Create task</button></div>
      </form>
    </Sheet>
  );
}

interface TaskEvent { kind: string; from_status: string | null; to_status: string | null; actor_label: string; created_at: string }

function TaskDetail({ task, onClose, onChange }: { task: Task | null; onClose: () => void; onChange: (p: Partial<Task>) => void }) {
  const { data: events } = useSWR<TaskEvent[]>(task ? `/tasks/${task.id}/events` : null, fetcher);
  const [timer, setTimer] = useState<{ id: string; msg: string } | null>(null);
  const timerMsg = timer && task && timer.id === task.id ? timer.msg : null;
  if (!task) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const startTimer = async () => {
    try { await api("/time-entries/start", { json: { task_id: task.id, project_id: task.project_id } }); setTimer({ id: task.id, msg: "Timer started — see the pill in the header." }); }
    catch (e) { setTimer({ id: task.id, msg: e instanceof ApiError ? e.message : "Could not start the timer" }); }
  };
  return (
    <Sheet open={!!task} onClose={onClose} title={task.title}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2"><DemoBadge show={task.is_demo} />{task.project_name && <span className="chip">{task.project_name}</span>}{task.requires_approval && <span className="chip">needs owner approval</span>}</div>
        {task.description && <p className="whitespace-pre-wrap text-muted">{task.description}</p>}
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">Status</span>
            <select className="input" value={task.status} onChange={(e) => onChange({ status: e.target.value as TaskStatus })}>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label><span className="label">Priority</span>
            <select className="input" value={task.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })}>{(["critical", "high", "medium", "low"] as Priority[]).map((p) => <option key={p}>{p}</option>)}</select></label>
        </div>
        <div className="flex items-center gap-2">
          {task.project_id && <button className="btn" onClick={startTimer}>Start timer</button>}
          {timerMsg && <span className="text-xs text-muted">{timerMsg}</span>}
        </div>
        <div>
          <div className="eyebrow mb-2">History</div>
          {!events?.length ? <div className="text-xs text-muted">No changes recorded yet.</div> : (
            <ul className="space-y-1.5 text-xs text-muted">
              {events.map((ev, i) => <li key={i}><span className="text-ink">{ev.actor_label}</span> {ev.kind === "created" ? "created the task" : <>moved it {ev.from_status ? <>from <b>{ev.from_status.replace(/_/g, " ")}</b> </> : null}to <b>{(ev.to_status ?? "").replace(/_/g, " ")}</b></>} · {relativeTime(ev.created_at)}</li>)}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}
