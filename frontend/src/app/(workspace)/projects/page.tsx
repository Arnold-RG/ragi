"use client";
import { ExternalLink, GitBranch, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Sheet } from "@/components/ui/Sheet";
import { Card, DemoBadge, Empty, PageHeader, Progress, Skeleton, StatusChip } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { OpenInMoneyHub } from "@/components/layout/OpenInMoneyHub";
import { formatDate, humanize } from "@/lib/format";
import type { Client, Project } from "@/lib/types";

const FILTERS = ["all", "active", "upcoming", "paused", "completed", "failed", "unverified"] as const;
const KIND_FILTERS = ["all", "own_product", "client"] as const;

function kindLabel(kind?: string | null) {
  if (kind === "own_product") return "Own product";
  if (kind === "client") return "Client";
  return null;
}


export default function ProjectsPage() {
  const { data, mutate } = useSWR<Project[]>("/projects", fetcher);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]>("all");
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const typed = (data ?? []).filter((p) => kind === "all" || p.kind === kind);
  const list = typed.filter((p) => filter === "all" || p.status === filter);
  const boardCols = FILTERS.filter((f) => f !== "all").map((f) => ({
    id: f, label: f[0].toUpperCase() + f.slice(1),
    items: typed.filter((p) => p.status === f),
    warning: f === "paused", error: f === "failed" || f === "unverified",
    emptyNote: f === "completed" ? "Nothing completed yet" : f === "failed" ? "No failed projects" : "No projects in this stage",
  }));
  return (
    <>
      <PageHeader eyebrow="Operate" title="Projects" subtitle="Own products and client work, with live sites where they exist. Progress comes from recorded tasks, never typed in."
        actions={
          <>
            <div className="seg" role="radiogroup" aria-label="View">
              <button type="button" role="radio" aria-checked={view === "board"} className={view === "board" ? "on" : ""} onClick={() => setView("board")}>Board</button>
              <button type="button" role="radio" aria-checked={view === "list"} className={view === "list" ? "on" : ""} onClick={() => setView("list")}>List</button>
            </div>
            <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> New project</button>
          </>
        } />
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label="Project type">
        {KIND_FILTERS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`chip h-8 shrink-0 px-3 ${kind === k ? "border-accent/50 bg-accent/15 text-ink" : ""}`}>
            {k === "all" ? "All types" : k === "own_product" ? "Own products" : "Clients"} {data && <span className="num text-faint">{k === "all" ? data.length : data.filter((p) => p.kind === k).length}</span>}
          </button>
        ))}
      </div>
      {view === "board" && data && (
        <KanbanBoard
          columns={boardCols}
          phone={phone}
          renderCard={(p, selected) => (
            <Link href={`/projects/${p.id}`} className={`kc block ${selected ? "sel" : ""}`}>
              <div className="body">
                <div className="flex flex-wrap gap-1">
                  <span className="lbl"><i style={{ background: "var(--c1)" }} />{humanize(p.category)}</span>
                  {kindLabel(p.kind) && <span className="lbl">{kindLabel(p.kind)}</span>}
                  <DemoBadge show={p.is_demo} />
                </div>
                <div className="title">{p.name}</div>
                <div className="text-xs" style={{ color: "var(--text2)" }}>{p.client_name ?? "Arnova Group"} · {p.task_done}/{p.task_total} tasks</div>
                <Progress value={p.progress} label={`${p.name} progress`} />
              </div>
            </Link>
          )}
        />
      )}
      {view === "board" && !data && <Skeleton className="h-96" />}
      {view === "list" && (<><div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip h-8 shrink-0 px-3 capitalize ${filter === f ? "border-accent/50 bg-accent/15 text-ink" : ""}`}>
            {f} {data && <span className="num text-faint">{f === "all" ? data.length : data.filter((p) => p.status === f).length}</span>}
          </button>
        ))}
      </div>
      {!data ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div> :
        list.length === 0 ? <Empty title="No projects here" /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((p, i) => (
              <Card key={p.id} delay={i * 0.03} className="group relative transition hover:border-line-strong">
                <Link href={`/projects/${p.id}`} className="absolute inset-0 z-0" aria-label={p.name} />
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="eyebrow mb-1">{humanize(p.category)}{kindLabel(p.kind) ? ` · ${kindLabel(p.kind)}` : ""}</div>
                    <h3 className="truncate font-display text-xl">{p.name}</h3>
                    <div className="truncate text-xs text-muted">{p.client_name ?? "Arnova Group"}</div>
                  </div>
                  <StatusChip status={p.status} />
                </div>
                {p.summary && <p className="mb-4 line-clamp-2 text-sm text-muted">{p.summary}</p>}
                <div className="mb-1 flex justify-between text-xs text-muted"><span>{p.task_done}/{p.task_total} tasks</span><span className="num">{p.progress}%</span></div>
                <Progress value={p.progress} label={`${p.name} progress`} />
                <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <DemoBadge show={p.is_demo} />
                  {!p.verified && !p.is_demo && <span className="chip" title="Not yet verified against the repository or live site">unverified</span>}
                  {p.repo_name && <span className="chip"><GitBranch size={11} /> {p.repo_owner}/{p.repo_name}</span>}
                  {p.production_url && <a href={p.production_url} target="_blank" rel="noreferrer noopener" className="chip hover:text-ink"><ExternalLink size={11} /> live</a>}
                  <span className="ml-auto">due {formatDate(p.due_date)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </>)}
      <NewProject open={creating} onClose={() => setCreating(false)} onCreated={() => mutate()} />
    </>
  );
}

function NewProject({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { data: clients } = useSWR<Client[]>(open ? "/clients" : null, fetcher);
  const [f, setF] = useState({ name: "", category: "client-website", client_id: "", due_date: "", summary: "" });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try {
      await api("/projects", { json: { ...f, client_id: f.client_id || null, due_date: f.due_date || null, summary: f.summary || null } });
      onCreated(); onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not create the project"); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New project">
      <form onSubmit={submit} className="space-y-3">
        <input className="input" placeholder="Project name" value={f.name} onChange={set("name")} required minLength={2} aria-label="Project name" />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={f.category} onChange={set("category")} aria-label="Category">
            {["client-website", "agency-website", "mobile-app", "product", "tool", "operations", "finance", "entertainment", "portfolio", "cybersecurity"].map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </select>
          <select className="input" value={f.client_id} onChange={set("client_id")} aria-label="Client"><option value="">Internal (Arnova Group)</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className="input" type="date" value={f.due_date} onChange={set("due_date")} aria-label="Due date" />
          <p className="col-span-2 text-xs text-muted">Budgets and rates are set in Our Money Hub. <OpenInMoneyHub /></p>
        </div>
        <textarea className="input min-h-20" placeholder="Summary" value={f.summary} onChange={set("summary")} aria-label="Summary" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Create</button></div>
      </form>
    </Sheet>
  );
}
