"use client";
import { Mail, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Sheet } from "@/components/ui/Sheet";
import { Card, DemoBadge, Empty, PageHeader, Skeleton, StatusChip } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import type { Client } from "@/lib/types";

export default function ClientsPage() {
  const { data, mutate } = useSWR<Client[]>("/clients", fetcher);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader eyebrow="Studio" title="Clients" subtitle="Who the studio works for. Billing identity lives in Our Money Hub."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> New client</button>} />
      {!data ? <Skeleton className="h-64" /> : data.length === 0 ? <Empty title="No clients yet" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c, i) => (
            <Card key={c.id} delay={i * 0.03}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-surface-3 font-display text-lg">{c.name[0]}</div>
                  <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted">{c.sector ?? "—"}</div></div>
                </div>
                <StatusChip status={c.status} />
              </div>
              <div className="mt-4 space-y-1 text-xs text-muted">
                {c.contact_name && <div>{c.contact_name}</div>}
                {c.email && <div className="flex items-center gap-1.5"><Mail size={12} /> {c.email}</div>}
                <div className="flex items-center gap-1.5"><MapPin size={12} /> {[c.city, c.country].filter(Boolean).join(", ")}</div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs"><span className="chip">{c.project_count} project{c.project_count === 1 ? "" : "s"}</span><DemoBadge show={c.is_demo} /></div>
            </Card>
          ))}
        </div>
      )}
      <NewClient open={creating} onClose={() => setCreating(false)} onCreated={() => mutate()} />
    </>
  );
}

function NewClient({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: "", contact_name: "", email: "", city: "", country: "RW", sector: "" });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try { await api("/clients", { json: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === "" ? null : v])) }); onCreated(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not save the client"); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New client">
      <form onSubmit={submit} className="grid grid-cols-2 gap-2">
        <input className="input col-span-2" placeholder="Client name" value={f.name} onChange={set("name")} required minLength={2} aria-label="Client name" />
        <input className="input" placeholder="Contact person" value={f.contact_name} onChange={set("contact_name")} aria-label="Contact person" />
        <input className="input" placeholder="Email" type="email" value={f.email} onChange={set("email")} aria-label="Email" />
        <input className="input" placeholder="City" value={f.city} onChange={set("city")} aria-label="City" />
        <input className="input" placeholder="Country (ISO, e.g. RW)" maxLength={2} value={f.country} onChange={set("country")} aria-label="Country" />
        <input className="input col-span-2" placeholder="Sector" value={f.sector} onChange={set("sector")} aria-label="Sector" />
        {error && <p role="alert" className="col-span-2 text-sm text-danger">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Save</button></div>
      </form>
    </Sheet>
  );
}
