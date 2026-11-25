"use client";
import { CheckCircle2, CircleDashed, RefreshCw } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Card, CardTitle, Skeleton, StatusChip } from "@/components/ui/primitives";
import { api, ApiError, fetcher } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { GithubSyncStatus, RegistryPlanItem } from "@/lib/types";

interface Integration { id: string; name: string; kind: string; connected: boolean; detail: string }

export function ConnectionsPanel({ isOwner }: { isOwner: boolean }) {
  const { data: ints, isLoading } = useSWR<{ items: Integration[] }>("/integrations", fetcher);
  const { data: sync, mutate: mutateSync } = useSWR<GithubSyncStatus>("/integrations/github/sync", fetcher);
  const [busy, setBusy] = useState<"sync" | "plan" | "apply" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<RegistryPlanItem[] | null>(null);

  async function runSync() {
    setBusy("sync"); setError(null); setMessage(null);
    try {
      const result = await api<{ ok?: boolean; result?: string; detail?: string; configured?: boolean }>("/integrations/github/sync", { method: "POST", json: {} });
      if (result.ok === false) setError(result.detail || "GitHub sync is not configured.");
      else setMessage(result.result || "Sync finished.");
      await mutateSync();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "GitHub sync failed. Try again in a minute.");
    } finally {
      setBusy(null);
    }
  }

  async function loadPlan() {
    setBusy("plan"); setError(null); setMessage(null);
    try {
      const result = await api<{ items: RegistryPlanItem[] }>("/integrations/registry/plan");
      setPlan(result.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the registry plan.");
    } finally {
      setBusy(null);
    }
  }

  async function applyPlan() {
    setBusy("apply"); setError(null); setMessage(null);
    try {
      const result = await api<{ ok: boolean; items: RegistryPlanItem[] }>("/integrations/registry/apply", { method: "POST", json: {} });
      setPlan(result.items);
      setMessage("Project registry updated. Kingdom Life was left untouched.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not apply the registry.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card delay={0.15}>
        <CardTitle>Connections</CardTitle>
        {isLoading || !ints ? <Skeleton className="h-32" /> : (
          <ul className="space-y-3 text-sm">
            {ints.items.map((i) => (
              <li key={i.id} className="flex items-start gap-3">
                {i.connected ? <CheckCircle2 size={16} className="mt-0.5 text-positive" /> : <CircleDashed size={16} className="mt-0.5 text-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{i.name}</span>
                    <StatusChip status={i.connected ? "connected" : "blocked"} label={i.connected ? "Connected" : "Off"} />
                  </div>
                  <div className="text-xs text-muted">{i.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isOwner && (
        <Card delay={0.2}>
          <CardTitle>GitHub sync</CardTitle>
          <p className="mb-3 text-sm text-muted">
            Refresh project names, Pages and homepage URLs from your Arnold-RG repositories. Uses a read-only token set on the server. Private repos stay hidden unless that is switched on.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <StatusChip status={sync?.configured ? "connected" : "blocked"} label={sync?.configured ? "Token on" : "Token not set"} />
            {sync?.last_at && <span>Last {relativeTime(sync.last_at)}{sync.last_ok === false ? " · failed" : ""}</span>}
            {sync?.last_result && <span className="min-w-0 break-words">{sync.last_result}</span>}
          </div>
          <button type="button" className="btn btn-primary" onClick={runSync} disabled={busy !== null || sync?.configured === false}>
            <RefreshCw size={14} className={busy === "sync" ? "animate-spin" : ""} />
            {busy === "sync" ? "Syncing…" : "Sync from GitHub"}
          </button>
          {sync?.configured === false && (
            <p className="mt-2 text-xs text-muted">Add a fine-grained read-only token as GITHUB_SYNC_TOKEN on the API service to turn this on.</p>
          )}
        </Card>
      )}

      {isOwner && (
        <Card delay={0.25}>
          <CardTitle>Project registry</CardTitle>
          <p className="mb-3 text-sm text-muted">
            Add your GitHub projects and live sites to RAGI. Own products and client work are labelled separately. Kingdom Life is left as it is.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={loadPlan} disabled={busy !== null}>{busy === "plan" ? "Reviewing…" : "Review plan"}</button>
            <button type="button" className="btn btn-primary" onClick={applyPlan} disabled={busy !== null}>{busy === "apply" ? "Updating…" : "Add to RAGI"}</button>
          </div>
          {plan && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 pr-3 font-medium">Project</th>
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Action</th>
                    <th className="pb-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((row) => (
                    <tr key={row.slug} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="py-2 pr-3 font-medium">{row.name}</td>
                      <td className="py-2 pr-3 capitalize">{row.kind.replace("_", " ")}</td>
                      <td className="py-2 pr-3">{row.action.replace("_", " ")}</td>
                      <td className="py-2 text-xs text-muted">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {(message || error) && (
        <p className="text-sm" style={{ color: error ? "var(--arn-danger)" : "var(--text2)" }}>{error || message}</p>
      )}
    </div>
  );
}
