"use client";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/primitives";

type Device = {
  id: string;
  label: string;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  current: boolean;
};

function when(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function TrustedDevices() {
  const [items, setItems] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Device[] }>("/auth/trusted-devices");
      setItems(r.items);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setItems([]);
      else setError("Could not load trusted devices.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async (id?: string) => {
    setBusy(id ?? "all");
    try {
      await api(id ? `/auth/trusted-devices/${id}` : "/auth/trusted-devices", { method: "DELETE" });
      await load();
    } catch {
      setError("Could not revoke that device.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card delay={0.12}>
      <CardTitle action={items && items.length > 0 ? (
        <button type="button" className="btn" disabled={busy === "all"} onClick={() => revoke()}>
          Revoke all
        </button>
      ) : undefined}>
        Trusted devices
      </CardTitle>
      <p className="mb-3 text-sm text-muted">
        After you sign in with your password and authenticator on a device, you can unlock it later with just the authenticator code. Revoke a device if it isn’t yours any more.
      </p>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {items === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No trusted devices yet. One is saved the next time you complete sign-in on this device.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {items.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  {d.label}
                  {d.current && (
                    <span className="chip inline-flex items-center gap-1 text-positive">
                      <ShieldCheck size={12} /> This device
                    </span>
                  )}
                </div>
                <div className="text-xs text-faint">Last used {when(d.last_used_at)} · Expires {when(d.expires_at)}</div>
              </div>
              <button type="button" className="btn shrink-0" disabled={busy === d.id} onClick={() => revoke(d.id)}>
                <Trash2 size={14} /> Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
