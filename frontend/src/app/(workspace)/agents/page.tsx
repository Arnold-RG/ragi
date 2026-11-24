"use client";
import { Bot, CheckCircle2, CircleSlash, Lock, ShieldAlert, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import useSWR from "swr";
import { Card, CardTitle, Empty, PageHeader, Skeleton, StatusChip, TbdNote } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { humanize, relativeTime } from "@/lib/format";
import type { Agent, AgentRun } from "@/lib/types";

export default function AgentsPage() {
  const { data: agents } = useSWR<Agent[]>("/agents", fetcher);
  const { data: runs, mutate: mutateRuns } = useSWR<AgentRun[]>("/agent-runs", fetcher);
  const [last, setLast] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tryDispatch = async (a: Agent) => {
    setError(null);
    try { setLast(await api<AgentRun>(`/agents/${a.slug}/dispatch`, { json: { capability: a.capabilities[0] ?? null } })); mutateRuns(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Dispatch failed"); }
  };
  const name = (id: string) => agents?.find((a) => a.id === id || a.slug === id)?.display_name ?? id;
  return (
    <>
      <PageHeader eyebrow="Intelligence" title="Agent workforce" subtitle="Jarvis, Forge, Sentinel, Nova and Mentor as governed workers. Every dispatch passes the same fail-closed guard." />
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warning" />
        <div><span className="font-medium">Placeholders only.</span> <span className="text-muted">AGENTS_ENABLED=false, no AI provider chosen and OMH budget reservation not connected. Dispatching shows exactly which checks block a run.</span></div>
      </div>
      <div className="mb-4"><TbdNote gap={17}>Final roster, providers (OpenAI / xAI) and per-agent capabilities are your decision.</TbdNote></div>
      {!agents ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a, i) => (
            <Card key={a.id} delay={i * 0.04}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-caramel/30 to-forest/40"><Bot size={20} /><span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-faint" /></div>
                  <div><div className="font-display text-xl">{a.display_name}</div><div className="text-xs text-muted">{a.role}</div></div>
                </div>
                <StatusChip status="pending" label={a.placeholder ? "placeholder" : a.connection} />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">{a.capabilities.slice(0, 5).map((c) => <span key={c} className="chip">{humanize(c)}</span>)}</div>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                <span>Department</span><span className="text-ink">{humanize(a.department)}</span>
                <span>Provider</span><span className="text-ink">{a.provider === "tbd" ? "Not chosen" : a.provider}</span>
                <span>Repository writes</span><span className="flex items-center gap-1 text-ink"><Lock size={11} /> off</span>
                <span>Runs</span><span className="num text-ink">{a.run_count}</span>
              </div>
              <button className="btn mt-4 w-full" onClick={() => tryDispatch(a)}>Test dispatch</button>
            </Card>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {last && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <Card>
            <CardTitle action={<StatusChip status={last.status} />}>Guard result · {name(last.agent_id)}</CardTitle>
            <ol className="space-y-2 text-sm">
              {last.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-2">
                  {c.passed ? <CheckCircle2 size={16} className="mt-0.5 text-positive" /> : <XCircle size={16} className="mt-0.5 text-danger" />}
                  <div><span className="font-medium">{humanize(c.name)}</span> <span className="text-muted">— {c.detail}</span></div>
                </li>
              ))}
            </ol>
          </Card>
        </motion.div>
      )}
      <Card className="mt-4">
        <CardTitle>Recent dispatches</CardTitle>
        {!runs ? <Skeleton className="h-24" /> : runs.length === 0 ? <Empty title="No dispatches yet" /> : (
          <ul className="divide-y divide-line text-sm">
            {runs.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <CircleSlash size={15} className="text-faint" />
                <div className="min-w-0 flex-1"><div className="truncate">{name(r.agent_id)} · {r.task_title ?? "ad-hoc"}</div><div className="truncate text-xs text-muted">{r.blocked_reason ?? "—"}</div></div>
                <StatusChip status={r.status} />
                <span className="hidden text-xs text-faint md:inline">{relativeTime(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
