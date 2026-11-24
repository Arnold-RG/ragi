"use client";
import { ExternalLink, GitBranch, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Sheet } from "@/components/ui/Sheet";
import { Card, DemoBadge, Empty, PageHeader, Progress, Skeleton, StatusChip } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { formatDate, humanize } from "@/lib/format";
import type { Client, Project } from "@/lib/types";

const FILTERS = ["all", "active", "upcoming", "paused", "completed", "unverified"] as const;

export default function ProjectsPage() {
  const { data, mutate } = useSWR<Project[]>("/projects", fetcher);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [creating, setCreating] = useState(false);
  const list = (data ?? []).filter((p) => filter === "all" || p.status === filter);
  return (
    <>
      <PageHeader eyebrow="Operate" title="Projects" subtitle="Ecosystem products and client work. Progress comes from recorded tasks, never typed in."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> New project</button>} />
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
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
                    <div className="eyebrow mb-1">{humanize(p.category)}</div>
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
      <NewProject open={creating} onClose={() => setCreating(false)} onCreated={() => mutate()} />
    </>
  );
}

function NewProject({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { data: clients } = useSWR<Client[]>(open ? "/clients" : null, fetcher);
  const [f, setF] = useState({ name: "", category: "client-website", client_id: "", due_date: "", hourly_rate: "", currency: "RWF", summary: "" });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try {
      await api("/projects", { json: { ...f, client_id: f.client_id || null, due_date: f.due_date || null, hourly_rate: f.hourly_rate || null, summary: f.summary || null } });
      onCreated(); onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not create the project"); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New project">
      <form onSubmit={submit} className="space-y-3">
        <input className="input" placeholder="Project name" value={f.name} onChange={set("name")} required minLength={2} aria-label="Project name" />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={f.category} onChange={set("category")} aria-label="Category">
            {["client-website", "agency-website", "mobile-app", "product", "operations", "finance", "entertainment", "portfolio", "cybersecurity"].map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </select>
          <select className="input" value={f.client_id} onChange={set("client_id")} aria-label="Client"><option value="">Internal (Arnova Group)</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input className="input" type="date" value={f.due_date} onChange={set("due_date")} aria-label="Due date" />
          <div className="flex gap-2"><input className="input" placeholder="Hourly rate" inputMode="decimal" value={f.hourly_rate} onChange={set("hourly_rate")} aria-label="Hourly rate" />
            <select className="input w-24" value={f.currency} onChange={set("currency")} aria-label="Currency">{["RWF", "PLN", "EUR", "USD"].map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <textarea className="input min-h-20" placeholder="Summary" value={f.summary} onChange={set("summary")} aria-label="Summary" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Create</button></div>
      </form>
    </Sheet>
  );
}
