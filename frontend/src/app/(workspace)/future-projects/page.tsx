"use client";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { OpenInMoneyHub } from "@/components/layout/OpenInMoneyHub";
import { Empty, PageHeader, Progress, Skeleton, StatusChip } from "@/components/ui/primitives";
import { api, fetcher } from "@/lib/api";

interface Future { id: string; name: string; summary: string | null; status: string; target_date: string | null; progress_pct: number; notes: string | null; open_in_money_hub: boolean }

export default function FutureProjectsPage() {
  const { data, isLoading } = useSWR<Future[]>("/future-projects", fetcher);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/future-projects", { json: { name: name.trim(), target_date: target || null } });
      setName(""); setTarget("");
      await mutate("/future-projects");
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Future projects" subtitle="Operational list only — no amounts. Use Open in Money Hub for budgets."
        actions={<OpenInMoneyHub className="btn btn-primary" />} />
      <form onSubmit={add} className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="fp-name">Project name</label>
          <input id="fp-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="fp-date">Target date</label>
          <input id="fp-date" className="input" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={busy}>Add</button>
      </form>
      {isLoading && <Skeleton className="h-40" />}
      {data && data.length === 0 && <Empty title="No future projects yet">Add a name and a target date. Amounts live in Our Money Hub.</Empty>}
      {data && data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Progress</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 font-semibold">{p.name}{p.summary ? <div className="font-normal text-xs" style={{ color: "var(--text2)" }}>{p.summary}</div> : null}</td>
                  <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                  <td className="px-4 py-3 num">{p.target_date ?? "—"}</td>
                  <td className="px-4 py-3 w-48"><Progress value={p.progress_pct} label={`${p.name} progress`} /></td>
                  <td className="px-4 py-3 text-right">{p.open_in_money_hub && <OpenInMoneyHub />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
