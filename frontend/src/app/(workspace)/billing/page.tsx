"use client";
import { ArrowRight, FileText, Plus, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Sheet } from "@/components/ui/Sheet";
import { Card, DemoBadge, Empty, PageHeader, Skeleton, StatusChip, TbdNote } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { formatMoney, relativeTime } from "@/lib/format";
import type { Client, Handoff, Project } from "@/lib/types";

const FLOW = ["draft", "pending_approval", "handed_to_omh", "issued", "paid"];

export default function BillingPage() {
  const { data, mutate } = useSWR<Handoff[]>("/billing-handoffs", fetcher);
  const [mode, setMode] = useState<"quote" | "invoice" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (h: Handoff) => {
    setError(null);
    try { await api(`/billing-handoffs/${h.id}/submit`, { method: "POST" }); mutate(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not submit"); }
  };
  return (
    <>
      <PageHeader eyebrow="Studio" title="Quotes & invoices" subtitle="RAGI prepares the request; you approve it; Our Money Hub issues the document and stays the book of record."
        actions={<><button className="btn" onClick={() => setMode("invoice")}><Receipt size={15} /> Invoice from time</button><button className="btn btn-primary" onClick={() => setMode("quote")}><Plus size={15} /> New quote</button></>} />
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {FLOW.map((s, i) => <span key={s} className="flex items-center gap-1.5"><StatusChip status={s} />{i < FLOW.length - 1 && <ArrowRight size={12} className="text-faint" />}</span>)}
      </div>
      <div className="mb-4"><TbdNote gap={12}>Event names <code>quotation.requested</code> / <code>invoice.requested</code> are a RAGI proposal waiting for your confirmation and OMH&apos;s.</TbdNote></div>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {!data ? <Skeleton className="h-48" /> : data.length === 0 ? <Empty title="Nothing prepared yet" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((h, i) => (
            <Card key={h.id} delay={i * 0.04}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-3">{h.kind === "quote" ? <FileText size={17} /> : <Receipt size={17} />}</div>
                  <div><div className="font-medium">{h.title}</div><div className="text-xs text-muted">{h.kind} · {h.client_name}{h.project_name ? ` · ${h.project_name}` : ""}</div></div>
                </div>
                <StatusChip status={h.status} />
              </div>
              <ul className="mt-4 space-y-1 text-sm">
                {h.lines.map((l, j) => <li key={j} className="flex justify-between gap-3"><span className="truncate text-muted">{l.description} <span className="text-faint">× {l.quantity}</span></span><span className="num">{formatMoney(l.amount, h.currency)}</span></li>)}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <div className="flex items-center gap-2 text-xs text-muted"><DemoBadge show={h.is_demo} />{h.omh_reference ? `OMH ${h.omh_reference}` : relativeTime(h.created_at)}</div>
                <div className="flex items-center gap-3"><span className="eyebrow">Draft total</span><span className="num font-display text-xl">{formatMoney(h.draft_total, h.currency)}</span></div>
              </div>
              {h.status === "draft" && <button className="btn btn-primary mt-3 w-full" onClick={() => submit(h)}>Send for owner approval</button>}
              {h.status === "pending_approval" && <a href="/approvals" className="btn mt-3 w-full">Waiting in approvals →</a>}
            </Card>
          ))}
        </div>
      )}
      <QuoteSheet open={mode === "quote"} onClose={() => setMode(null)} onDone={() => mutate()} />
      <InvoiceSheet open={mode === "invoice"} onClose={() => setMode(null)} onDone={() => mutate()} />
    </>
  );
}

function QuoteSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { data: clients } = useSWR<Client[]>(open ? "/clients" : null, fetcher);
  const [client, setClient] = useState("");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("RWF");
  const [lines, setLines] = useState([{ description: "", quantity: "1", unit_amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try { await api("/billing-handoffs/quotes", { json: { client_id: client, title, currency, lines } }); onDone(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not prepare the quote"); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="New quote request">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select className="input" value={client} onChange={(e) => setClient(e.target.value)} required aria-label="Client"><option value="">Choose client</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="input w-24" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">{["RWF", "PLN", "EUR", "USD"].map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} aria-label="Title" />
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_4rem_7rem_auto] gap-2">
            <input className="input" placeholder="Line description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} required aria-label="Line description" />
            <input className="input" value={l.quantity} inputMode="decimal" onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} aria-label="Quantity" />
            <input className="input" placeholder="Unit price" inputMode="decimal" value={l.unit_amount} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_amount: e.target.value } : x))} required aria-label="Unit price" />
            <button type="button" className="btn btn-ghost px-2" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label="Remove line"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={() => setLines([...lines, { description: "", quantity: "1", unit_amount: "" }])}><Plus size={14} /> Add line</button>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Prepare draft</button></div>
      </form>
    </Sheet>
  );
}

function InvoiceSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { data: projects } = useSWR<Project[]>(open ? "/projects" : null, fetcher);
  const [project, setProject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const billable = (projects ?? []).filter((p) => p.client_id && p.hourly_rate);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try { await api("/billing-handoffs/invoices/from-time", { json: { project_id: project } }); onDone(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not prepare the invoice"); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Invoice request from billable time">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">Collects every unbilled billable time entry on the project at its hourly rate. Those entries are reserved until you approve or reject.</p>
        <select className="input" value={project} onChange={(e) => setProject(e.target.value)} required aria-label="Project"><option value="">Choose project</option>{billable.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatMoney(p.hourly_rate, p.currency)}/h</option>)}</select>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Prepare draft</button></div>
      </form>
    </Sheet>
  );
}
