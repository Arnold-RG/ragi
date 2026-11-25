"use client";
import clsx from "clsx";
import { ArrowRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { KanbanBoard, type KanbanColumn } from "@/components/kanban/KanbanBoard";
import { Sheet } from "@/components/ui/Sheet";
import { DemoBadge, PageHeader, Skeleton } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { OpenInMoneyHub } from "@/components/layout/OpenInMoneyHub";
import type { Lead } from "@/lib/types";

const STAGES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal", warning: true },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost", error: true },
];


function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone;
}

export default function PipelinePage() {
  const { data, mutate } = useSWR<Lead[]>("/leads", fetcher);
  const [open, setOpen] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>(["new", "lost"]);
  const phone = usePhone();
  const move = async (l: Lead, stage: string) => {
    setError(null);
    try { await api(`/leads/${l.id}`, { method: "PATCH", json: { stage } }); mutate(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not move the lead"); }
  };
  const columns: KanbanColumn<Lead>[] = STAGES.map((s) => {
    const leads = (data ?? []).filter((l) => l.stage === s.id);
    return {
      id: s.id, label: s.label, items: leads,
      warning: "warning" in s && s.warning, error: "error" in s && s.error,
      emptyNote: s.id === "won" ? "Nothing won yet" : s.id === "lost" ? "No lost leads" : "No leads in this stage",
    };
  });
  return (
    <>
      <PageHeader title="Pipeline" subtitle="From first enquiry to signed work. A won lead becomes a client and an upcoming project in one step."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> New card</button>} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!data ? <Skeleton className="h-96" /> : (
        <KanbanBoard
          columns={columns}
          phone={phone}
          collapsedIds={phone ? [] : collapsed}
          onToggleCollapse={(id) => setCollapsed((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id])}
          activeId={open?.id}
          onMove={(l, stage) => { if (l.stage !== stage && l.stage !== "won") move(l, stage); }}
          renderCard={(l, selected) => (
            <button type="button" onClick={() => setOpen(l)} className={clsx("kc w-full text-left", selected && "sel")}>
              <div className="body">
                <div className="flex flex-wrap gap-1">
                  {l.service && <span className="lbl"><i style={{ background: "var(--c1)" }} />{l.service}</span>}
                  <DemoBadge show={l.is_demo} />
                </div>
                <div className="title">{l.company ?? l.name}</div>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text2)" }}>
                  <span>{l.name}</span>
                  <span className="ml-auto">{relativeTime(l.updated_at)}</span>
                </div>
              </div>
            </button>
          )}
        />
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
          <div><div className="eyebrow">Estimate</div><div className="text-xs text-muted">Amounts live in Our Money Hub.<br /><OpenInMoneyHub /></div></div>
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
  const [f, setF] = useState({ name: "", company: "", email: "", service: "", source: "" });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === "" ? null : v]));
    try { await api("/leads", { json: { ...body, estimated_amount: null } }); onCreated(); onClose(); }
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
        <p className="col-span-2 text-xs text-muted">Estimates and fees are set in Our Money Hub. <OpenInMoneyHub /></p>
        {error && <p role="alert" className="col-span-2 text-sm text-danger">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Save lead</button></div>
      </form>
    </Sheet>
  );
}
