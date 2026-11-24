"use client";
import { Check, FileText, LifeBuoy, LogOut, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Card, CardTitle, DemoBadge, Empty, Progress, Skeleton, StatusChip } from "@/components/ui/primitives";
import { api, fetcher } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { PortalOverview } from "@/lib/types";

export default function PortalPage() {
  const router = useRouter();
  const { data } = useSWR<PortalOverview>("/portal/overview", fetcher);
  const logout = async () => { await api("/auth/logout", { method: "POST" }).catch(() => {}); router.replace("/login"); };
  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-16 md:px-8">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1"><ThemeToggle /><button type="button" className="btn btn-ghost icon-btn p-0" onClick={logout} aria-label="Sign out"><LogOut size={17} /></button></div>
      </header>
      {!data ? <Skeleton className="mt-8 h-64" /> : (
        <>
          <div className="mt-6 mb-8">
            <div className="eyebrow mb-2">Client portal</div>
            <h1 className="font-display text-3xl md:text-[2.5rem]">{data.client.name} <DemoBadge show={data.client.is_demo} /></h1>
            <p className="mt-2 text-sm text-muted">Your projects with Arnova Group, their milestones and the documents issued to you.</p>
          </div>
          <div className="space-y-4">
            {data.projects.length === 0 ? <Empty title="No projects yet" /> : data.projects.map((p, i) => (
              <Card key={p.id} delay={i * 0.05}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><div className="font-display text-xl">{p.name}</div>{p.summary && <p className="text-sm text-muted">{p.summary}</p>}</div>
                  <StatusChip status={p.status} />
                </div>
                <div className="mt-4 flex items-center gap-3"><Progress value={p.progress} label={`${p.name} progress`} /><span className="num text-sm">{p.progress}%</span></div>
                <div className="mt-1 text-xs text-muted">Target date {formatDate(p.due_date)}</div>
                <ol className="mt-4 grid gap-2 md:grid-cols-3">
                  {p.milestones.map((m) => (
                    <li key={m.title} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm">
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${m.done ? "border-positive bg-positive text-black" : "border-line-strong"}`}>{m.done && <Check size={12} />}</span>
                      <span className="min-w-0 flex-1 truncate">{m.title}</span><span className="text-xs text-muted">{formatDate(m.due_date)}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardTitle><span className="flex items-center gap-2"><FileText size={15} /> Documents</span></CardTitle>
                {data.documents.length === 0 ? <p className="text-sm text-muted">No quotes or invoices issued yet.</p> : (
                  <ul className="space-y-2 text-sm">{data.documents.map((d, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{d.title}</span><StatusChip status={d.status} /></li>)}</ul>
                )}
              </Card>
              <Card delay={0.05}><CardTitle><span className="flex items-center gap-2"><Paperclip size={15} /> Files</span></CardTitle><p className="text-sm text-muted">{data.files.detail}</p></Card>
              <Card delay={0.1}><CardTitle><span className="flex items-center gap-2"><LifeBuoy size={15} /> Support</span></CardTitle><p className="text-sm text-muted">{data.support.detail}</p></Card>
            </div>
          </div>
          <p className="mt-10 text-center text-xs text-muted">Created by Arnold Rurangwa / Arnova Group</p>
        </>
      )}
    </div>
  );
}
