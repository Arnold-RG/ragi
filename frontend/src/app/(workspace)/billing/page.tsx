"use client";
import { FileText, Receipt } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { OpenInMoneyHub } from "@/components/layout/OpenInMoneyHub";
import { Card, DemoBadge, Empty, PageHeader, Skeleton, StatusChip } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { Handoff } from "@/lib/types";

/**
 * Quotes and invoices are issued in Our Money Hub. RAGI only tracks approval status
 * for requests already handed over — never amounts, rates or totals.
 */
export default function BillingPage() {
  const { data, mutate } = useSWR<Handoff[]>("/billing-handoffs", fetcher);
  const [error, setError] = useState<string | null>(null);
  const submit = async (h: Handoff) => {
    setError(null);
    try { await api(`/billing-handoffs/${h.id}/submit`, { method: "POST" }); mutate(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not submit"); }
  };
  return (
    <>
      <PageHeader
        eyebrow="Studio"
        title="Handoffs"
        subtitle="Approval status only. Amounts, quotes and invoices live in Our Money Hub."
        actions={<OpenInMoneyHub className="btn btn-primary" />}
      />
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {!data ? <Skeleton className="h-48" /> : data.length === 0 ? (
        <Empty title="Nothing to hand over">Prepare quotes and invoices in Our Money Hub, then review approvals here.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((h, i) => (
            <Card key={h.id} delay={i * 0.04}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-3">{h.kind === "quote" ? <FileText size={17} /> : <Receipt size={17} />}</div>
                  <div>
                    <div className="font-medium">{h.title}</div>
                    <div className="text-xs text-muted">{h.kind} · {h.client_name}{h.project_name ? ` · ${h.project_name}` : ""} · {h.lines.length} line{h.lines.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <StatusChip status={h.status} />
              </div>
              <ul className="mt-4 space-y-1 text-sm">
                {h.lines.map((l, j) => (
                  <li key={j} className="truncate text-muted">{l.description}{l.quantity ? <span className="text-faint"> · qty {l.quantity}</span> : null}</li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                <span className="flex items-center gap-2"><DemoBadge show={h.is_demo} />{relativeTime(h.created_at)}</span>
                <OpenInMoneyHub />
              </div>
              {h.status === "draft" && <button className="btn btn-primary mt-3 w-full" onClick={() => submit(h)}>Send for owner approval</button>}
              {h.status === "pending_approval" && <a href="/approvals" className="btn mt-3 w-full">Waiting in approvals →</a>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
