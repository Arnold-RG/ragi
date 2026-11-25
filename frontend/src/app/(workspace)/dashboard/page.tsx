"use client";
import { Bot, CheckCircle2, Folder, Shield, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import { LiveActivity } from "@/components/dashboard/LiveActivity";
import { ThroughputChart } from "@/components/dashboard/ThroughputChart";
import { AlarmBanner } from "@/components/ui/AlarmBanner";
import { KpiCard } from "@/components/ui/KpiCard";
import { DemoBadge, Empty, PageHeader, Progress, Skeleton, StatusChip } from "@/components/ui/primitives";
import { fetcher } from "@/lib/api";
import { humanize } from "@/lib/format";
import type { Agent, AgentRun, Project, Summary } from "@/lib/types";

const STATUS_COLOR: Record<string, string> = {
  active: "var(--c1)", upcoming: "var(--c5)", paused: "var(--bar-warning)",
  completed: "var(--c4)", failed: "var(--danger)", unverified: "var(--c3)",
};
const STATUS_ORDER = ["active", "upcoming", "paused", "completed", "failed", "unverified"] as const;

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function ProjectsByStatus({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const known = new Set<string>(STATUS_ORDER);
  const rows: { id: string; n: number }[] = [
    ...STATUS_ORDER.map((id) => ({ id, n: byStatus[id] ?? 0 })),
    ...Object.entries(byStatus).filter(([id]) => !known.has(id)).map(([id, n]) => ({ id, n })),
  ].filter((r) => r.n > 0);
  const denom = total || 1;
  return (
    <>
      <div className="mb-2.5 flex overflow-hidden rounded-[7px]" style={{ height: 14, gap: 3 }} role="img" aria-label="Projects by status">
        {rows.map((r) => <i key={r.id} style={{ flex: r.n, background: STATUS_COLOR[r.id] ?? "var(--c1)" }} title={`${humanize(r.id)}: ${r.n}`} />)}
      </div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 border-b text-sm" style={{ height: 31, borderColor: "var(--border)" }}>
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR[r.id] ?? "var(--c1)" }} />
          <span className="flex-1">{humanize(r.id)}</span>
          <span className="num font-bold">{r.n}</span>
          <span className="num w-11 text-right text-xs" style={{ color: "var(--faint)" }}>{Math.round(r.n / denom * 100)}%</span>
        </div>
      ))}
    </>
  );
}

export default function DashboardPage() {
  const { data: s } = useSWR<Summary>("/dashboard/summary", fetcher, { refreshInterval: 60000 });
  const { data: projects } = useSWR<Project[]>("/projects", fetcher);
  const { data: agents } = useSWR<Agent[]>("/agents", fetcher);
  const { data: runs } = useSWR<AgentRun[]>("/agent-runs", fetcher);
  const today = useMemo(() => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), []);

  const inProgress = s?.projects.active ?? 0;
  const finished = s?.projects.completed ?? 0;
  const failedProjects = (projects ?? []).filter((p) => p.status === "failed").length;
  const pausedProjects = (projects ?? []).filter((p) => p.status === "paused").length;
  const blockedTasks = s?.tasks.by_status?.blocked ?? 0;
  const failedBlocked = failedProjects + pausedProjects + blockedTasks;
  const todayRuns = (runs ?? []).filter((r) => isToday(r.created_at));
  const sparkDone = s?.tasks.throughput_14d.map((d) => d.completed) ?? [];
  const sparkCreated = s?.tasks.throughput_14d.map((d) => d.created) ?? [];

  const inMotion = (projects ?? []).filter((p) => p.status === "active" || p.status === "paused" || p.status === "failed");
  const byStatus = s?.projects.by_status ?? {};
  const projectTotal = s?.projects.total ?? 0;

  return (
    <>
      <PageHeader
        title="Operations overview"
        subtitle={<>{today}{s?.demo_data ? " · " : ""}{s?.demo_data && <DemoBadge />}</>}
        actions={
          <>
            <Link href="/approvals" className="btn">{s?.approvals.pending ? `${s.approvals.pending} to review` : "Approvals"}</Link>
            <Link href="/projects" className="btn btn-primary">Open projects</Link>
          </>
        }
      />
      {!s ? (
        <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <>
          {s.agents.emergency_stop && (
            <AlarmBanner
              message="Agent emergency stop is on — all dispatches are blocked."
              count={s.agents.runs_blocked}
              action={<Link href="/agents" className="btn">Review stop</Link>}
            />
          )}

          <div className="kpis">
            <KpiCard hero label="In progress" value={inProgress} icon={<Folder size={14} />}
              series={sparkCreated} period={`${s.projects.upcoming} upcoming`}
              badge={inProgress > 0 ? <span className="pill ok">Active</span> : undefined} />
            <KpiCard label="Finished" value={finished} icon={<CheckCircle2 size={14} />}
              series={sparkDone} sparkColor="var(--c4)" period={`${s.projects.total} projects in all`} />
            <KpiCard label="Failed / blocked" value={failedBlocked} icon={<ShieldAlert size={14} />}
              sparkColor="var(--danger)"
              period={[
                failedProjects ? `${failedProjects} failed` : null,
                pausedProjects ? `${pausedProjects} paused` : null,
                blockedTasks ? `${blockedTasks} blocked tasks` : null,
              ].filter(Boolean).join(" · ") || "None right now"}
              badge={failedBlocked > 0 ? <span className="pill err">Needs attention</span> : undefined} />
            <KpiCard label="Agent tasks today" value={runs ? todayRuns.length : "—"} icon={<Bot size={14} />}
              sparkColor="var(--c3)"
              period={runs && todayRuns.length
                ? `${todayRuns.filter((r) => r.status === "failed" || r.status === "blocked").length} failed or blocked today`
                : "No agent runs recorded today"}
              badge={s.approvals.pending > 0 ? <span className="pill warn">{s.approvals.pending} approvals</span> : undefined} />
          </div>

          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="card flex-1 p-4" style={{ flex: 1.2 }}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="m-0 text-sm font-bold">Project progress</h3>
                <span className="faint text-xs">Active, paused and failed</span>
                <span className="flex-1" />
                <Link href="/projects" className="linkish">All projects</Link>
              </div>
              {!projects ? <Skeleton className="h-36" /> : inMotion.length === 0 ? (
                <Empty title="No projects in motion">Active, paused or failed work will show a progress bar here.</Empty>
              ) : inMotion.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="grid gap-1 border-b py-2 no-underline" style={{ borderColor: "var(--border)", color: "inherit" }}>
                  <div className="flex items-center gap-2 text-sm">
                    <b className="font-semibold">{p.name}</b>
                    {p.is_demo && <DemoBadge />}
                    <StatusChip status={p.status} />
                    <span className="flex-1" />
                    <span className="faint num text-[11.5px]">{p.task_done} / {p.task_total} tasks · {p.progress}%</span>
                  </div>
                  <Progress value={p.progress} label={`${p.name} progress`} />
                </Link>
              ))}
            </div>
            <div className="card flex-1 p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="m-0 text-sm font-bold">Projects by status</h3>
                <span className="faint text-xs">{projectTotal} total</span>
                <span className="flex-1" />
              </div>
              {projectTotal === 0 ? <Empty title="No projects yet">Counts by status appear once a project exists.</Empty> : (
                <ProjectsByStatus byStatus={byStatus} total={projectTotal} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="card flex-1 p-4" style={{ flex: 1.15 }}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="m-0 text-sm font-bold">Agent work</h3>
                <span className="faint text-xs">{s.agents.enabled} enabled of {s.agents.total}</span>
                <span className="flex-1" />
                <Link href="/agents" className="linkish">Workforce</Link>
              </div>
              {!agents ? <Skeleton className="h-36" /> : agents.length === 0 ? (
                <Empty title="No agents yet">Governed agents and their runs will be listed here.</Empty>
              ) : (
                <div className="grid gap-2">
                  {agents.map((a) => {
                    const mine = (runs ?? []).filter((r) => r.agent_id === a.id || r.agent_id === a.slug || r.agent_slug === a.slug);
                    const current = mine.find((r) => ["running", "queued", "pending_approval"].includes(r.status));
                    const done = mine.filter((r) => r.status === "verified").length;
                    const failures = mine.filter((r) => r.status === "failed" || r.status === "blocked").length;
                    return (
                      <div key={a.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                        <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--s3)" }}><Bot size={14} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <b className="font-semibold">{a.display_name}</b>
                            <StatusChip status={a.enabled ? a.connection : "not_connected"} />
                          </div>
                          <div className="text-xs" style={{ color: "var(--text2)" }}>
                            {current
                              ? <>Current: {current.task_title ?? "ad-hoc run"} · {humanize(current.status)}</>
                              : a.open_tasks > 0
                                ? `${a.open_tasks} open task${a.open_tasks === 1 ? "" : "s"}`
                                : "Idle — no current task"}
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs tabular-nums" style={{ color: "var(--text2)" }}>
                          <span><b className="text-[var(--text)]">{done}</b> done</span>
                          <span><b className="text-[var(--text)]">{failures}</b> failed</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="card flex-1 p-4">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="m-0 text-sm font-bold">Activity</h3>
                <span className="flex-1" />
                <Link href="/audit-logs" className="linkish">Audit log</Link>
              </div>
              {s.activity.length === 0 ? (
                <Empty title="No activity yet">Recorded project, task and agent events will appear in this feed.</Empty>
              ) : <LiveActivity initial={s.activity} />}
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="m-0 text-sm font-bold">Task throughput</h3>
              <span className="faint text-xs">Last 14 days</span>
              <span className="flex-1" />
              {s.approvals.pending > 0 && (
                <Link href="/approvals" className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--text2)" }}>
                  <Shield size={12} /> {s.approvals.pending} awaiting approval
                </Link>
              )}
            </div>
            {s.tasks.throughput_14d.every((d) => d.completed === 0 && d.created === 0) ? (
              <Empty title="No task movement yet">Completed and opened tasks will appear here.</Empty>
            ) : <ThroughputChart data={s.tasks.throughput_14d} />}
            <div className="legend mt-2">
              <span><i style={{ background: "var(--c1)" }} />Completed</span>
              <span><i style={{ background: "var(--danger)" }} />Opened (above completed)</span>
              <span className="flex-1" />
              <Link href="/tasks" className="text-xs" style={{ color: "var(--text2)" }}>View as table</Link>
            </div>
          </div>


        </>
      )}
    </>
  );
}
