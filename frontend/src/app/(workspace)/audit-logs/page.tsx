"use client";
import { useState } from "react";
import useSWR from "swr";
import { Card, Empty, PageHeader, Skeleton, TbdNote } from "@/components/ui/primitives";
import { fetcher } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { AuditRow } from "@/lib/types";

export default function AuditPage() {
  const { data } = useSWR<AuditRow[]>("/audit-logs", fetcher);
  const [q, setQ] = useState("");
  const rows = (data ?? []).filter((r) => !q || `${r.action} ${r.summary ?? ""} ${r.actor_label}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader eyebrow="Control" title="Audit log" subtitle="Append-only record of sign-ins, decisions, dispatches and changes, scoped to your organisation." />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center"><input className="input md:max-w-xs" placeholder="Filter actions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter audit log" /><TbdNote gap={28}>Retention period not decided.</TbdNote></div>
      {!data ? <Skeleton className="h-80" /> : rows.length === 0 ? <Empty title="No entries" /> : (
        <Card className="p-0">
          <ul className="divide-y divide-line text-sm">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_auto] gap-2 px-5 py-3 md:grid-cols-[14rem_1fr_auto]">
                <code className="truncate text-xs text-accent">{r.action}</code>
                <div className="order-3 col-span-2 min-w-0 truncate text-muted md:order-none md:col-span-1">{r.summary ?? `${r.subject_type ?? ""} ${r.subject_id ?? ""}`}</div>
                <div className="text-right text-xs text-faint">{r.actor_label} · {relativeTime(r.created_at)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
