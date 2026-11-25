"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Sheet } from "@/components/ui/Sheet";
import { Card, DemoBadge, Empty, PageHeader, Progress, Skeleton, StatusChip } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { formatDate, formatMinutes } from "@/lib/format";
import type { Client, Retainer } from "@/lib/types";

export default function RetainersPage() {
  const { data, mutate } = useSWR<Retainer[]>("/retainers", fetcher);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader eyebrow="Studio" title="Retainers" subtitle="Monthly care plans. Usage comes from billable time logged on linked projects; RAGI warns at 80%."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> New retainer</button>} />
      {!data ? <Skeleton className="h-48" /> : data.length === 0 ? <Empty title="No retainers yet" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((r, i) => (
            <Card key={r.id} delay={i * 0.05}>
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-display text-xl">{r.name}</div><div className="text-xs text-muted">{r.client_name}</div></div>
                <div className="flex gap-2"><DemoBadge show={r.is_demo} /><StatusChip status={r.usage_state} label={r.usage_state === "ok" ? "on track" : r.usage_state} /></div>
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div><div className="num font-display text-4xl">{r.used_pct}%</div><div className="text-xs text-muted">{formatMinutes(r.used_minutes)} of {r.hours_per_month} h this month (from {formatDate(r.month_start)})</div></div>
                <div className="text-right text-xs text-muted"><div className="eyebrow">Monthly fee</div>—</div>
              </div>
              <div className="mt-3"><Progress value={r.used_pct} label={`${r.name} usage`} /></div>
              <div className="mt-4 flex flex-wrap gap-1.5">{r.projects.map((p) => <span key={p.id} className="chip">{p.name}</span>)}{r.projects.length === 0 && <span className="text-xs text-muted">No projects linked yet — link one from the project settings.</span>}</div>
            </Card>
          ))}
        </div>
      )}
      <NewRetainer open={creating} onClose={() => setCreating(false)} onCreated={() => mutate()} />
    </>
  );
}

function NewRetainer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { data: clients } = useSWR<Client[]>(open ? "/clients" : null, fetcher);
  const [f, setF] = useState({ client_id: "", name: "", hours_per_month: "10", starts_on: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try { await api("/retainers", { json: { ...f, hours_per_month: Number(f.hours_per_month), monthly_fee: null } }); onCreated(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not save"); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New retainer">
      <form onSubmit={submit} className="grid grid-cols-2 gap-2">
        <select className="input col-span-2" value={f.client_id} onChange={set("client_id")} required aria-label="Client"><option value="">Choose client</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input className="input col-span-2" placeholder="Plan name" value={f.name} onChange={set("name")} required minLength={2} aria-label="Plan name" />
        <input className="input" type="number" min={1} max={744} value={f.hours_per_month} onChange={set("hours_per_month")} aria-label="Hours per month" />
        <input className="input" type="date" value={f.starts_on} onChange={set("starts_on")} aria-label="Starts on" />
        {error && <p role="alert" className="col-span-2 text-sm text-danger">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Save</button></div>
      </form>
    </Sheet>
  );
}
