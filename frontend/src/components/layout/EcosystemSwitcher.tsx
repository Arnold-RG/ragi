"use client";
import { ArrowUpRight } from "lucide-react";
import { omhPublicUrl } from "@/lib/ecosystem-urls";

const OMH_URL = omhPublicUrl();

/** RAGI ⇄ Our Money Hub. Separate apps, accounts and sessions — no shared SSO. */
export function EcosystemSwitcher() {
  return (
    <div className="flex rounded-xl border border-line bg-surface-2 p-1 text-xs">
      <span className="flex-1 rounded-lg bg-surface-3 px-2.5 py-1.5 text-center font-semibold">RAGI</span>
      <a href={OMH_URL} className="flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-muted hover:text-ink" title="Opens Our Money Hub. It uses a separate account and session.">
        Money Hub <ArrowUpRight size={12} />
      </a>
    </div>
  );
}
