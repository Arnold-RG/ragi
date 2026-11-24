"use client";
import clsx from "clsx";
import { ArrowRight, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import useSWR from "swr";
import { Sheet } from "@/components/ui/Sheet";
import { DemoBadge, PageHeader, Skeleton } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { formatMoney, relativeTime } from "@/lib/format";
import type { Lead } from "@/lib/types";

const STAGES = [
  { id: "new", label: "New", tone: "var(--arn-faint)" },
  { id: "contacted", label: "Contacted", tone: "var(--arn-muted)" },
  { id: "qualified", label: "Qualified", tone: "var(--arn-info)" },
  { id: "proposal", label: "Proposal", tone: "var(--arn-accent)" },
  { id: "won", label: "Won", tone: "var(--arn-positive)" },
  { id: "lost", label: "Lost", tone: "var(--arn-danger)" },
];

function totals(leads: Lead[]) {
  // per currency, exact decimal strings → integer minor units (BigInt), never floats
  const by: Record<string, bigint> = {};
  for (const l of leads) {
    if (!l.estimated_amount) continue;
    const [i, f = ""] = l.estimated_amount.split(".");
    by[l.currency] = (by[l.currency] ?? BigInt(0)) + BigInt(i) * BigInt(100) + BigInt((f + "00").slice(0, 2));
  }
  return Object.entries(by).map(([c, v]) => formatMoney(`${v / BigInt(100)}.${String(v % BigInt(100)).padStart(2, "0")}`, c));
}

export default function PipelinePage() {
  const { data, mutate } = useSWR<Lead[]>("/leads", fetcher);
  const [open, setOpen] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const move = async (l: Lead, stage: string) => {
    setError(null);
    try { await api(`/leads/${l.id}`, { method: "PATCH", json: { stage } }); mutate(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not move the lead"); }
  };
  return (
    <>
      <PageHeader eyebrow="Studio" title="Client pipeline" subtitle="From first enquiry to signed work. A won lead becomes a client and an upcoming project in one step."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> New lead</button>} />
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {!data ? <Skeleton className="h-96" /> : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {STAGES.map((s) => {
            const leads = data.filter((l) => l.stage === s.id);
            return (
              <div key={s.id} className="flex w-72 shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface-2/40 p-2"
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const l = data.find((x) => x.id === e.dataTransfer.getData("text/lead")); if (l && l.stage !== s.id && l.stage !== "won") move(l, s.id); }}>
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: s.tone }} />{s.label}<span className="num text-faint">{leads.length}</span></div>
                  <div className="num mt-0.5 min-h-4 text-xs text-faint">{totals(leads).join(" · ")}</div>
                </div>
                <div className="flex min-h-20 flex-col gap-2">
                  {leads.map((l, i) => (
                    <motion.div key={l.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <div draggable={l.stage !== "won"} onDragStart={(e) => e.dataTransfer.setData("text/lead", l.id)} onClick={() => setOpen(l)} className="card cursor-pointer p-3 text-sm">
                        <div className="font-medium">{l.company ?? l.name}</div>
                        <div className="text-xs text-muted">{l.service ?? "—"}{l.source ? ` · via ${l.source}` : ""}</div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="num">{formatMoney(l.estimated_amount, l.currency)}</span>
                          <DemoBadge show={l.is_demo} />
                          <span className="ml-auto text-faint">{relativeTime(l.updated_at)}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <LeadSheet lead={open} onClose={() => setOpen(null)} onChanged={() => { mutate(); setOpen(null); }} move={move} />
      <NewLead open={creating} onClose={() => setCreating(false)} onCreated={() => mutate()} />
    </>
  );
}

function LeadSheet({ lead, onClose, onChanged, move }: { lead: Lead | null; onClose: () => void; onChanged: () => void; move: (l: Lead, s: string) => Promise<void> }) {
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!lead) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const convert = async () => {
    setError(null);
    try { await api(`/leads/${lead.id}/convert`, { json: { project_name: projectName || `${lead.company ?? lead.name} — website` } }); onChanged(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not convert"); }
  };
  return (
    <Sheet open onClose={onClose} title={lead.company ?? lead.name}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2"><DemoBadge show={lead.is_demo} /><span className="chip">{lead.stage}</span>{lead.service && <span className="chip">{lead.service}</span>}</div>
        <div className="grid grid-cols-2 gap-3">
          <div><div className="eyebrow">Contact</div><div>{lead.name}</div><div className="text-xs text-muted">{lead.email ?? "no email"}</div></div>
          <div><div className="eyebrow">Estimate</div><div className="num">{formatMoney(lead.estimated_amount, lead.currency)}</div></div>
        </div>
        {lead.notes && <p className="text-muted">{lead.notes}</p>}
        {lead.stage !== "won" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.filter((s) => s.id !== lead.stage && s.id !== "won").map((s) => <button key={s.id} className="chip h-8 px-3" onClick={() => move(lead, s.id).then(onChanged)}>Move to {s.label}</button>)}
            </div>
            <div className="rounded-2xl border border-line bg-surface-2/60 p-3">
              <div className="mb-2 text-xs font-semibold">Mark as won</div>
              <div className="flex gap-2">
                <input className="input h-9" placeholder={`${lead.company ?? lead.name} — website`} value={projectName} onChange={(e) => setProjectName(e.target.value)} aria-label="Project name" />
                <button className={clsx("btn btn-primary h-9 shrink-0")} onClick={convert}>Won <ArrowRight size={14} /></button>
              </div>
              <div className="mt-2 text-xs text-muted">Creates the client and an upcoming project.</div>
            </div>
          </>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}

function NewLead({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: "", company: "", email: "", service: "", source: "", estimated_amount: "", currency: "RWF" });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === "" ? null : v]));
    try { await api("/leads", { json: { ...body, currency: f.currency } }); onCreated(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not save the lead"); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New lead">
      <form onSubmit={submit} className="grid grid-cols-2 gap-2">
        <input className="input col-span-2" placeholder="Contact name" value={f.name} onChange={set("name")} required minLength={2} aria-label="Contact name" />
        <input className="input" placeholder="Company" value={f.company} onChange={set("company")} aria-label="Company" />
        <input className="input" placeholder="Email" type="email" value={f.email} onChange={set("email")} aria-label="Email" />
        <input className="input" placeholder="Service (website, app…)" value={f.service} onChange={set("service")} aria-label="Service" />
        <input className="input" placeholder="Source (referral, Instagram…)" value={f.source} onChange={set("source")} aria-label="Source" />
        <input className="input" placeholder="Estimated amount" inputMode="decimal" value={f.estimated_amount} onChange={set("estimated_amount")} aria-label="Estimated amount" />
        <select className="input" value={f.currency} onChange={set("currency")} aria-label="Currency">{["RWF", "PLN", "EUR", "USD"].map((c) => <option key={c}>{c}</option>)}</select>
        {error && <p role="alert" className="col-span-2 text-sm text-danger">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Save lead</button></div>
      </form>
    </Sheet>
  );
}
