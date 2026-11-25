"use client";
import { RefreshCw } from "lucide-react";
import useSWR from "swr";
import { OpenInMoneyHub } from "@/components/layout/OpenInMoneyHub";
import { Card, CardTitle, Empty, Skeleton, StatusChip } from "@/components/ui/primitives";
import { fetcher } from "@/lib/api";
import type { OmhCurrencyRow, OmhFinanceResponse, OmhMoney } from "@/lib/types";

const STATUS_LABEL: Record<OmhFinanceResponse["status"], string> = {
  ok: "Connected",
  unlinked: "Not linked yet",
  not_configured: "Not connected",
  asleep: "Asleep or starting",
  error: "Unavailable",
};

function money(row: OmhMoney | undefined) {
  if (!row || !row.amount) return "—";
  return `${row.currency} ${row.amount}`;
}

function CurrencyTable({ rows }: { rows: Record<string, OmhCurrencyRow> }) {
  const codes = Object.keys(rows);
  if (!codes.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="pb-2 pr-3 font-medium">Currency</th>
            <th className="pb-2 pr-3 font-medium">Balance</th>
            <th className="pb-2 pr-3 font-medium">Income this month</th>
            <th className="pb-2 font-medium">Expenses this month</th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => {
            const r = rows[code];
            return (
              <tr key={code} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="py-2.5 pr-3 font-semibold">{code}</td>
                <td className="num py-2.5 pr-3">{money(r.balance)}</td>
                <td className="num py-2.5 pr-3">{money(r.income_month)}</td>
                <td className="num py-2.5">{money(r.expenses_month)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Each currency stands alone. Figures are never added across currencies.</p>
    </div>
  );
}

export function FinanceFromOmh() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<OmhFinanceResponse>(
    "/integrations/omh/summary",
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const status = data?.status ?? (error ? "error" : undefined);
  const payload = data?.summary;
  const currencies = payload?.by_currency ?? {};
  const hasFigures = Object.keys(currencies).length > 0;
  const budgets = payload?.ai_budgets ?? [];

  return (
    <Card delay={0.12}>
      <CardTitle action={
        <div className="flex items-center gap-2">
          {status && <StatusChip status={status === "ok" ? "connected" : status === "asleep" ? "pending" : status === "unlinked" ? "upcoming" : "blocked"} label={STATUS_LABEL[status]} />}
          <button type="button" className="btn" onClick={() => mutate()} disabled={isValidating} aria-label="Refresh Money Hub figures">
            <RefreshCw size={14} className={isValidating ? "animate-spin" : ""} />
            Refresh
          </button>
          <OpenInMoneyHub className="btn btn-primary inline-flex items-center gap-1" />
        </div>
      }>
        Our Money Hub
      </CardTitle>

      {isLoading && !data ? (
        <Skeleton className="h-28" />
      ) : !data || status === "not_configured" ? (
        <Empty title="Our Money Hub is not connected yet">
          {data?.detail || "The service link is not set on this server."} Figures will appear here once the connection is on.
        </Empty>
      ) : status === "asleep" || status === "error" ? (
        <Empty title={status === "asleep" ? "Our Money Hub is asleep or still starting" : "Could not load figures"}>
          {data.detail} Free hosting can take a couple of minutes to wake. Refresh, or open Money Hub directly.
        </Empty>
      ) : status === "unlinked" ? (
        <Empty title="No workspace is linked yet">
          {data.detail} Open Money Hub to finish setup, then refresh this card.
        </Empty>
      ) : !hasFigures && budgets.length === 0 ? (
        <Empty title="No figures this month yet">
          Connected to Our Money Hub. Income, expenses and balances will show here per currency when they exist.
        </Empty>
      ) : (
        <>
          {payload?.month && <p className="mb-3 text-xs text-muted">Month {payload.month}{payload.as_of ? ` · as of ${payload.as_of}` : ""}</p>}
          <CurrencyTable rows={currencies} />
          {budgets.length > 0 && (
            <div className={hasFigures ? "mt-4" : ""}>
            <p className="mb-2 text-xs font-medium text-muted">AI budgets</p>
            <ul className="space-y-2 text-sm">
              {budgets.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
                  <span>
                    <span className="font-medium">{b.name}</span>
                    {b.ragi_project_id && <span className="ml-2 text-xs text-muted">Project {b.ragi_project_id}</span>}
                  </span>
                  <span className="num text-xs text-muted">
                    {b.available ? `Available ${b.available.currency} ${b.available.amount}` : b.state || ""}
                  </span>
                </li>
              ))}
            </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
