"use client";
import useSWR from "swr";
import { LiveActivity } from "@/components/dashboard/LiveActivity";
import { Empty, PageHeader, Skeleton } from "@/components/ui/primitives";
import { fetcher } from "@/lib/api";
import type { Summary } from "@/lib/types";

export default function ActivityPage() {
  const { data: s } = useSWR<Summary>("/dashboard/summary", fetcher, { refreshInterval: 15000 });
  return (
    <>
      <PageHeader title="Activity" subtitle="Recorded events from this workspace — live." />
      {!s ? <Skeleton className="h-64" /> : (s.activity?.length ? <div className="card p-4"><LiveActivity initial={s.activity} /></div> : <Empty title="No activity yet">Work in projects, tasks and approvals will show up here.</Empty>)}
    </>
  );
}
