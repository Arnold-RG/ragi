"use client";
import { Check, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { useMe } from "@/components/layout/AuthProvider";
import { Card, DemoBadge, Empty, PageHeader, Skeleton, StatusChip, TbdNote } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { humanize, relativeTime } from "@/lib/format";
import type { Approval } from "@/lib/types";

export default function ApprovalsPage() {
  const me = useMe();
  const { data, mutate } = useSWR<Approval[]>("/approvals", fetcher);
  const [error, setError] = useState<string | null>(null);
  const decide = async (a: Approval, decision: "approved" | "rejected") => {
    setError(null);
    try { await api(`/approvals/${a.id}/decide`, { json: { decision } }); mutate(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not record the decision"); }
  };
  const pending = (data ?? []).filter((a) => a.status === "pending");
  const decided = (data ?? []).filter((a) => a.status !== "pending");
  return (
    <>
      <PageHeader eyebrow="Control" title="Approvals" subtitle="Nothing financial or risky leaves RAGI without your decision. Only the owner can approve." />
      <div className="mb-4"><TbdNote gap={18}>Which actions need approval beyond quotes, invoices, agent runs and publishing is your call.</TbdNote></div>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {!data ? <Skeleton className="h-40" /> : (
        <>
          <h2 className="eyebrow mb-3">Waiting · {pending.length}</h2>
          {pending.length === 0 ? <Empty title="All clear">Nothing is waiting for you.</Empty> : (
            <div className="space-y-3">
              {pending.map((a, i) => (
                <Card key={a.id} delay={i * 0.04}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning"><ShieldCheck size={18} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 font-medium">{a.title} <span className="chip">{humanize(a.kind)}</span><DemoBadge show={a.is_demo} /></div>
                      {a.detail && <div className="text-sm text-muted">{a.detail}</div>}
                      <div className="text-xs text-faint">Requested by {a.requested_by} · {relativeTime(a.created_at)}</div>
                    </div>
                    {me?.role === "owner" ? (
                      <div className="flex gap-2"><button className="btn" onClick={() => decide(a, "rejected")}><X size={14} /> Reject</button><button className="btn btn-primary" onClick={() => decide(a, "approved")}><Check size={14} /> Approve</button></div>
                    ) : <span className="text-xs text-muted">Owner decision</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}
          <h2 className="eyebrow mb-3 mt-8">Decided</h2>
          {decided.length === 0 ? <Empty title="No decisions yet" /> : (
            <Card><ul className="divide-y divide-line text-sm">{decided.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1 truncate">{a.title}</div><StatusChip status={a.status} /><span className="hidden text-xs text-faint md:inline">{a.decided_by} · {a.decided_at ? relativeTime(a.decided_at) : ""}</span></li>
            ))}</ul></Card>
          )}
        </>
      )}
    </>
  );
}
