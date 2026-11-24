"use client";
import { AlertTriangle, ArrowUpRight, Bot, Clock, Handshake, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { LiveActivity } from "@/components/dashboard/LiveActivity";
import { ThroughputChart } from "@/components/dashboard/ThroughputChart";
import { useMe } from "@/components/layout/AuthProvider";
import { Card, CardTitle, DemoBadge, Empty, PageHeader, Progress, Skeleton, Stat, StatusChip } from "@/components/ui/primitives";
import { fetcher } from "@/lib/api";
import { formatDate, formatMinutes, formatMoney, greeting } from "@/lib/format";
import type { Summary } from "@/lib/types";

export default function DashboardPage() {
  const me = useMe();
  const { data: s } = useSWR<Summary>("/dashboard/summary", fetcher, { refreshInterval: 60000 });
  const first = me?.full_name.split(" ")[0] ?? "";
  return (
    <>
      <PageHeader
        eyebrow="Operations · Arnova Group"
        title={`${greeting()}, ${first}`}
        subtitle={<>Everything across the studio in one view: delivery, pipeline, time, retainers and the agent workforce. {s?.demo_data && <DemoBadge />}</>}
        actions={<><Link href="/tasks" className="btn">Open tasks</Link><Link href="/pipeline" className="btn btn-primary">Pipeline <ArrowUpRight size={15} /></Link></>}
      />
      {!s ? (
        <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <div className="space-y-4">
          {s.agents.emergency_stop && (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warning" />
              <div><span className="font-medium">Agent emergency stop is on.</span> <span className="text-muted">AGENTS_ENABLED=false — no agent can run, write to repositories or deploy. Repository writes and production deploys are also off.</span></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card><Stat label="Active projects" value={s.projects.active} hint={`${s.projects.upcoming} upcoming · ${s.projects.completed} completed`} /></Card>
            <Card delay={0.05}><Stat label="Open tasks" value={s.tasks.open} hint={s.tasks.overdue ? <span className="text-danger">{s.tasks.overdue} overdue</span> : "Nothing overdue"} /></Card>
            <Card delay={0.1}><Stat label="Billable this month" value={formatMinutes(s.time.billable_minutes)} hint={`${formatMinutes(s.time.non_billable_minutes)} non-billable`} /></Card>
            <Card delay={0.15}><Stat label="Awaiting your approval" value={s.approvals.pending} tone={s.approvals.pending ? "var(--arn-warning)" : undefined} hint={<Link href="/approvals" className="hover:text-ink">Review queue →</Link>} /></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" delay={0.1}>
              <CardTitle action={<span className="text-xs text-muted">last 14 days</span>}>Task throughput</CardTitle>
              <ThroughputChart data={s.tasks.throughput_14d} />
            </Card>
            <Card delay={0.15}>
              <CardTitle action={<Link href="/pipeline" className="text-xs text-muted hover:text-ink">Open</Link>}><span className="flex items-center gap-2"><Handshake size={15} /> Pipeline</span></CardTitle>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between"><span className="text-sm text-muted">Open leads</span><span className="num font-display text-2xl">{s.pipeline.open}</span></div>
                <div className="flex items-baseline justify-between"><span className="text-sm text-muted">Won</span><span className="num text-lg">{s.pipeline.won}</span></div>
                <div className="border-t border-line pt-3">
                  <div className="eyebrow mb-2">Open value · per currency, never summed</div>
                  {Object.entries(s.pipeline.value_by_currency).length === 0 ? <div className="text-sm text-muted">—</div> :
                    Object.entries(s.pipeline.value_by_currency).map(([c, v]) => <div key={c} className="num text-sm">{formatMoney(v, c)}</div>)}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" delay={0.1}>
              <CardTitle action={<Link href="/projects" className="text-xs text-muted hover:text-ink">All projects</Link>}>Active delivery</CardTitle>
              {s.active_projects.length === 0 ? <Empty title="No active projects" /> : (
                <ul className="divide-y divide-line">
                  {s.active_projects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 md:grid-cols-[1.6fr_1fr_auto]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 truncate text-sm font-medium">{p.name} <DemoBadge show={p.is_demo} />{!p.verified && !p.is_demo && <span className="chip ">unverified</span>}</div>
                          <div className="truncate text-xs text-muted">{p.client_name ?? "Arnova Group"} · due {formatDate(p.due_date)}</div>
                        </div>
                        <div className="hidden items-center gap-3 md:flex"><Progress value={p.progress} /><span className="num w-10 text-right text-xs text-muted">{p.progress}%</span></div>
                        <StatusChip status={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card delay={0.15}>
              <CardTitle><span className="flex items-center gap-2"><Clock size={15} /> Retainers</span></CardTitle>
              {s.retainers.length === 0 ? <Empty title="No retainers yet" /> : s.retainers.map((r) => (
                <div key={r.id} className="mb-4 last:mb-0">
                  <div className="mb-1.5 flex items-center justify-between text-sm"><span className="truncate">{r.name}</span><StatusChip status={r.usage_state} label={`${r.used_pct}%`} /></div>
                  <Progress value={r.used_pct} />
                  <div className="mt-1 text-xs text-muted">{formatMinutes(r.used_minutes)} of {r.hours_per_month} h · {r.client_name}</div>
                </div>
              ))}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card delay={0.1}>
              <CardTitle action={<Link href="/agents" className="text-xs text-muted hover:text-ink">Roster</Link>}><span className="flex items-center gap-2"><Bot size={15} /> Agent workforce</span></CardTitle>
              <ul className="space-y-2.5">
                {s.agents.items.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0"><div className="font-medium">{a.display_name}</div><div className="truncate text-xs text-muted">{a.role}</div></div>
                    <StatusChip status={a.status === "connected" ? "connected" : "pending"} label={a.status === "connected" ? "connected" : "placeholder"} />
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-xs text-muted">{s.agents.runs_blocked} dispatches blocked by the safety guard.</div>
            </Card>
            <Card delay={0.15}>
              <CardTitle><span className="flex items-center gap-2"><ShieldCheck size={15} /> Billing hand-offs to OMH</span></CardTitle>
              {Object.keys(s.billing.by_status).length === 0 ? <Empty title="Nothing prepared yet" /> : (
                <div className="flex flex-wrap gap-2">{Object.entries(s.billing.by_status).map(([k, v]) => <StatusChip key={k} status={k} label={`${v} ${k.replace(/_/g, " ")}`} />)}</div>
              )}
              <div className="mt-4 text-xs text-muted">RAGI prepares quote and invoice requests; Our Money Hub issues them and stays the book of record.</div>
              <div className="mt-4 border-t border-line pt-3">
                <div className="eyebrow mb-1">Our Money Hub</div>
                {s.omh?.connected ? (
                  <div className="space-y-2">
                    <div className="text-sm text-positive">Connected</div>
                    {s.omh.has_data && s.omh.by_currency && Object.keys(s.omh.by_currency).length > 0 ? (
                      <ul className="space-y-1">
                        {Object.entries(s.omh.by_currency).map(([cur, row]) => (
                          <li key={cur} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-muted">{cur}</span>
                            <span className="num">{formatMoney(row.balance?.amount ?? null, row.balance?.currency ?? cur)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <div className="text-sm text-muted">Connected — no balances in this period.</div>}
                    {s.omh.note && <div className="text-xs text-muted">{s.omh.note}</div>}
                  </div>
                ) : (
                  <div className="text-sm text-muted">{s.omh?.message ?? "OMH is not connected."}</div>
                )}
              </div>
              <div className="mt-4 border-t border-line pt-3">
                <div className="eyebrow mb-1">Websites</div>
                <div className="text-sm">{s.websites.checked ? `${s.websites.up}/${s.websites.checked} up` : <span className="text-muted">{s.websites.total} tracked · not checked yet</span>}</div>
              </div>
            </Card>
            <Card delay={0.2}>
              <CardTitle>Live activity</CardTitle>
              <LiveActivity initial={s.activity} />
            </Card>
          </div>
          {s.tasks.overdue > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted"><AlertTriangle size={13} className="text-warning" /> Overdue counts use each task&apos;s due date in UTC.</div>
          )}
        </div>
      )}
    </>
  );
}
