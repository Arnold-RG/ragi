"use client";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { TaskWorkspace } from "@/components/tasks/TaskWorkspace";
import { Card, CardTitle, DemoBadge, PageHeader, Progress, Skeleton, Stat, StatusChip } from "@/components/ui/primitives";
import { api, fetcher } from "@/lib/api";
import { formatDate, formatMinutes, humanize } from "@/lib/format";
import { OpenInMoneyHub } from "@/components/layout/OpenInMoneyHub";
import type { Project, TimeEntry } from "@/lib/types";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, mutate } = useSWR<Project>(`/projects/${id}`, fetcher);
  const { data: time } = useSWR<TimeEntry[]>(`/time-entries?project_id=${id}&days=90`, fetcher);
  const [ms, setMs] = useState("");
  if (!p) return <Skeleton className="h-80" />;
  const billable = (time ?? []).filter((t) => t.billable).reduce((a, t) => a + t.minutes, 0);
  const unbilled = (time ?? []).filter((t) => t.billable && !t.billed).reduce((a, t) => a + t.minutes, 0);
  const setStatus = async (status: string) => { await api(`/projects/${p.id}`, { method: "PATCH", json: { status } }); mutate(); };
  const addMilestone = async (e: React.FormEvent) => { e.preventDefault(); if (ms.trim().length < 2) return; await api(`/projects/${p.id}/milestones`, { json: { title: ms } }); setMs(""); mutate(); };
  return (
    <>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"><ArrowLeft size={13} /> Projects</Link>
      <PageHeader eyebrow={humanize(p.category)} title={p.name}
        subtitle={<>{p.client_name ?? "Arnova Group"} {p.summary ? `· ${p.summary}` : ""} <DemoBadge show={p.is_demo} /></>}
        actions={<>
          <select className="input h-10 w-auto" value={p.status} onChange={(e) => setStatus(e.target.value)} aria-label="Project status">
            {["upcoming", "active", "paused", "completed", "failed", "unverified"].map((s) => <option key={s}>{s}</option>)}
          </select>
          {p.production_url && <a className="btn" href={p.production_url} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Live site</a>}
        </>} />
      <div className="grid gap-4 md:grid-cols-4">
        <Card><Stat label="Progress" value={`${p.progress}%`} hint={`${p.task_done} of ${p.task_total} tasks done`} /><div className="mt-3"><Progress value={p.progress} label={`${p.name} progress`} /></div></Card>
        <Card delay={0.05}><Stat label="Due" value={<span className="text-2xl">{formatDate(p.due_date)}</span>} hint={<StatusChip status={p.status} />} /></Card>
        <Card delay={0.1}><Stat label="Billable time · 90 days" value={formatMinutes(billable)} hint={`${formatMinutes(unbilled)} not invoiced yet`} /></Card>
        <Card delay={0.15}><Stat label="Budgets & rates" value={<OpenInMoneyHub className="text-base font-semibold" />} hint="Project budgets and rates live in Our Money Hub." /></Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><CardTitle>Tasks</CardTitle><TaskWorkspace projectId={p.id} compact /></div>
        <Card>
          <CardTitle>Milestones</CardTitle>
          <ul className="space-y-2">
            {p.milestones?.map((m) => (
              <li key={m.id}>
                <button className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={async () => { await api(`/projects/${p.id}/milestones/${m.id}/toggle`, { method: "POST" }); mutate(); }}>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border ${m.done ? "border-positive bg-positive text-black" : "border-line-strong"}`}>{m.done && <Check size={12} />}</span>
                  <span className={m.done ? "text-muted line-through" : ""}>{m.title}</span>
                  <span className="ml-auto text-xs text-faint">{formatDate(m.due_date)}</span>
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addMilestone} className="mt-3 flex gap-2"><input className="input h-9" placeholder="Add milestone" value={ms} onChange={(e) => setMs(e.target.value)} aria-label="New milestone" /><button className="btn h-9">Add</button></form>
        </Card>
      </div>
    </>
  );
}
