"use client";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Sheet } from "@/components/ui/Sheet";
import { Card, Empty, PageHeader, Skeleton, StatusChip, TbdNote } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { Website } from "@/lib/types";

export default function WebsitesPage() {
  const { data, mutate } = useSWR<Website[]>("/websites", fetcher);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = async (w: Website) => {
    setBusy(w.id); setError(null);
    try { await api(`/websites/${w.id}/check`, { method: "POST" }); mutate(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Check failed"); }
    finally { setBusy(null); }
  };
  return (
    <>
      <PageHeader eyebrow="Control" title="Websites" subtitle="On-demand availability checks. Only public addresses are checked; every redirect is re-validated."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> Track a site</button>} />
      <div className="mb-4"><TbdNote gap={22}>Scheduled checks, alert thresholds and who gets alerted are not decided yet.</TbdNote></div>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {!data ? <Skeleton className="h-40" /> : data.length === 0 ? <Empty title="No sites tracked" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((w) => (
            <Card key={w.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="font-medium">{w.label}</div>
                  <a href={w.url} target="_blank" rel="noreferrer noopener" className="link-hit gap-1 truncate text-xs text-muted hover:text-ink">{w.url} <ExternalLink size={11} /></a></div>
                <StatusChip status={w.status === "unknown" ? "pending" : w.status} label={w.status === "unknown" ? "not checked" : w.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><div className="eyebrow">HTTP</div><div className="num">{w.last_status_code ?? "—"}</div></div>
                <div><div className="eyebrow">Response</div><div className="num">{w.last_response_ms != null ? `${w.last_response_ms} ms` : "—"}</div></div>
                <div><div className="eyebrow">Checked</div><div>{w.last_checked_at ? relativeTime(w.last_checked_at) : "never"}</div></div>
              </div>
              <button className="btn mt-4 w-full" onClick={() => check(w)} disabled={busy === w.id}><RefreshCw size={14} className={busy === w.id ? "animate-spin" : ""} /> Check now</button>
            </Card>
          ))}
        </div>
      )}
      <NewSite open={creating} onClose={() => setCreating(false)} onCreated={() => mutate()} />
    </>
  );
}

function NewSite({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("https://");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try { await api("/websites", { json: { label, url } }); onCreated(); onClose(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not add the site"); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Track a website">
      <form onSubmit={submit} className="space-y-3">
        <input className="input" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} required minLength={2} aria-label="Label" />
        <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required aria-label="URL" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary">Track</button></div>
      </form>
    </Sheet>
  );
}
