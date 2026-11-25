"use client";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";
import { Card, CardTitle, DemoBadge, PageHeader, Skeleton, TbdNote } from "@/components/ui/primitives";
import { fetcher } from "@/lib/api";
import { formatMinutes, humanize } from "@/lib/format";
import type { Summary, TimeSummary } from "@/lib/types";

interface Row { project: string; status: string; category: string; client: string; tasks_done: number; tasks_total: number; progress_pct: number; due_date: string; demo: boolean }
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--faint)"];
const tip = { contentStyle: { background: "var(--arn-surface)", border: "1px solid var(--arn-border)", borderRadius: 12, fontSize: 12 }, labelStyle: { color: "var(--arn-text)" } };

export default function ReportsPage() {
  const { data } = useSWR<{ rows: Row[]; generated_at: string }>("/reports/operations", fetcher);
  const { data: s } = useSWR<Summary>("/dashboard/summary", fetcher);
  const { data: t } = useSWR<TimeSummary>("/time-entries/summary", fetcher);
  const statusData = s ? Object.entries(s.tasks.by_status).map(([k, v]) => ({ name: humanize(k), value: v })) : [];
  const timeData = (t?.projects ?? []).map((p) => ({ name: (p.project_name ?? "").split(" ").slice(0, 2).join(" "), billable: Math.round(p.billable / 6) / 10, non: Math.round(p.non_billable / 6) / 10 }));
  return (
    <>
      <PageHeader eyebrow="Intelligence" title="Reports" subtitle="Every number is computed from recorded tasks and time. Exports neutralise spreadsheet formulas."
        actions={<a className="btn btn-primary" href="/api/v1/reports/operations?format=csv"><Download size={15} /> Export CSV</a>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle action={<span className="text-xs text-muted">{t ? `${formatMinutes(t.total_billable)} billable` : ""}</span>}>Hours this month by project</CardTitle>
          {!t ? <Skeleton className="h-64" /> : (
            <div className="h-64"><ResponsiveContainer><BarChart data={timeData}><CartesianGrid stroke="var(--arn-border)" vertical={false} /><XAxis dataKey="name" tick={{ fill: "var(--arn-muted)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "var(--arn-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={30} /><Tooltip {...tip} cursor={{ fill: "var(--arn-surface-2)" }} /><Bar dataKey="billable" name="Billable h" stackId="a" fill="var(--c1)" radius={[0, 0, 0, 0]} /><Bar dataKey="non" name="Non-billable h" stackId="a" fill="var(--c4)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          )}
        </Card>
        <Card delay={0.05}>
          <CardTitle>Tasks by status</CardTitle>
          {!s ? <Skeleton className="h-64" /> : (
            <div className="flex h-64 items-center gap-4">
              <div className="h-full flex-1"><ResponsiveContainer><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={3} stroke="none">{statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer></div>
              <ul className="space-y-1.5 text-xs">{statusData.map((d, i) => <li key={d.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{d.name}<span className="num ml-auto pl-3 text-muted">{d.value}</span></li>)}</ul>
            </div>
          )}
        </Card>
      </div>
      <Card className="mt-4" delay={0.1}>
        <CardTitle>Operations report</CardTitle>
        {!data ? <Skeleton className="h-40" /> : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-5 py-2 font-medium">Project</th><th className="font-medium">Client</th><th className="font-medium">Status</th><th className="font-medium">Tasks</th><th className="font-medium">Progress</th><th className="pr-5 font-medium">Due</th></tr></thead>
              <tbody>{data.rows.map((r) => (
                <tr key={r.project} className="border-b border-line last:border-0"><td className="px-5 py-2.5"><span className="font-medium">{r.project}</span> <DemoBadge show={r.demo} /></td><td className="text-muted">{r.client || "Arnova Group"}</td><td>{humanize(r.status)}</td><td className="num">{r.tasks_done}/{r.tasks_total}</td><td className="num">{r.progress_pct}%</td><td className="pr-5 text-muted">{r.due_date || "—"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="mt-4"><TbdNote gap={24}>Revenue and cash-flow reports are not available in this workspace yet.</TbdNote></div>
    </>
  );
}
