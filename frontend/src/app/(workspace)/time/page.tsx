"use client";
import { Play, Plus, Square } from "lucide-react";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Card, CardTitle, DemoBadge, Empty, PageHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { formatMinutes, relativeTime } from "@/lib/format";
import type { Project, TimeEntry, TimeSummary } from "@/lib/types";

export default function TimePage() {
  const { mutate: globalMutate } = useSWRConfig();
  const { data: entries, mutate } = useSWR<TimeEntry[]>("/time-entries?days=30", fetcher);
  const { data: summary, mutate: mutateSummary } = useSWR<TimeSummary>("/time-entries/summary", fetcher);
  const { data: running } = useSWR<TimeEntry | null>("/time-entries/running", fetcher);
  const { data: projects } = useSWR<Project[]>("/projects?status=active,upcoming", fetcher);
  const [project, setProject] = useState("");
  const [note, setNote] = useState("");
  const [minutes, setMinutes] = useState("");
  const [billable, setBillable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => { mutate(); mutateSummary(); globalMutate("/time-entries/running"); };
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); refresh(); } catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong"); } };
  return (
    <>
      <PageHeader eyebrow="Operate" title="Time" subtitle="One running timer at a time. Billable time feeds retainers and invoice requests." />
      <Card className="mb-4">
        <div className="flex flex-col gap-2 md:flex-row">
          <select className="input md:w-64" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project"><option value="">Choose project</option>{projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input className="input flex-1" placeholder="What are you working on?" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <label className="flex items-center gap-2 px-2 text-sm text-muted"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable</label>
          <input className="input md:w-28" placeholder="min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} aria-label="Minutes for manual entry" />
          {running ? (
            <button className="btn btn-primary" onClick={() => act(() => api(`/time-entries/${running.id}/stop`, { method: "POST" }))}><Square size={14} /> Stop {running.project_name}</button>
          ) : minutes ? (
            <button className="btn btn-primary" disabled={!project} onClick={() => act(async () => { await api("/time-entries", { json: { project_id: project, minutes: Number(minutes), note: note || null, billable } }); setMinutes(""); setNote(""); })}><Plus size={14} /> Log {minutes} min</button>
          ) : (
            <button className="btn btn-primary" disabled={!project} onClick={() => act(() => api("/time-entries/start", { json: { project_id: project, note: note || null, billable } }))}><Play size={14} /> Start timer</button>
          )}
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>This month</CardTitle>
          {!summary ? <Skeleton className="h-32" /> : (
            <>
              <div className="grid grid-cols-2 gap-4"><Stat label="Billable" value={formatMinutes(summary.total_billable)} /><Stat label="Non-billable" value={formatMinutes(summary.total_non_billable)} /></div>
              <ul className="mt-5 space-y-2 text-sm">
                {summary.projects.map((p) => (
                  <li key={p.project_id} className="flex items-center justify-between gap-2"><span className="truncate">{p.project_name}</span><span className="num text-muted">{formatMinutes(p.billable)} <span className="text-faint">· {formatMinutes(p.unbilled_billable)} unbilled</span></span></li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <Card className="lg:col-span-2" delay={0.05}>
          <CardTitle>Last 30 days</CardTitle>
          {!entries ? <Skeleton className="h-48" /> : entries.length === 0 ? <Empty title="No time logged yet" /> : (
            <ul className="divide-y divide-line text-sm">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${e.running ? "bg-accent" : e.billable ? "bg-positive" : "bg-faint"}`} />
                  <div className="min-w-0 flex-1"><div className="truncate">{e.task_title ?? e.note ?? "Work session"}</div><div className="truncate text-xs text-muted">{e.project_name} · {relativeTime(e.started_at)}</div></div>
                  <DemoBadge show={e.is_demo} />
                  {e.billed && <span className="chip">invoiced</span>}
                  <span className="num w-16 text-right">{e.running ? "running" : formatMinutes(e.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
