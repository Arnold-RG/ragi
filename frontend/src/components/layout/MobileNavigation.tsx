"use client";
import clsx from "clsx";
import { FolderKanban, LayoutDashboard, Plus, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Sheet } from "@/components/ui/Sheet";
import { fetcher } from "@/lib/api";
import type { Summary } from "@/lib/types";
import { EcosystemSwitcher } from "./EcosystemSwitcher";
import { NAV } from "./nav";

export function MobileNavigation({ onSearch }: { onSearch?: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const { data: s } = useSWR<Summary>("/dashboard/summary", fetcher, { refreshInterval: 60000 });
  const [more, setMore] = useState(false);
  const pending = s?.approvals.pending ?? 0;
  const tabs = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/pipeline", label: "Board", icon: FolderKanban },
  ];
  return (
    <>
      <nav aria-label="Primary" className="tabbar lg:hidden">
        {tabs.map((n) => {
          const on = path === n.href || path.startsWith(n.href + "/");
          return (
            <Link key={n.href} href={n.href} className={clsx("tab", on && "on")} aria-current={on ? "page" : undefined}>
              <n.icon size={18} strokeWidth={on ? 2.3 : 1.8} />
              <span className="tab-label">{n.label}</span>
            </Link>
          );
        })}
        <button type="button" className="tab" aria-label="New" onClick={() => setMore(true)}>
          <span className="tab-new grid place-items-center"><Plus size={22} strokeWidth={2.4} /></span>
        </button>
        <Link href="/approvals" className={clsx("tab", path.startsWith("/approvals") && "on")} aria-current={path.startsWith("/approvals") ? "page" : undefined}>
          <span className="relative">
            <ShieldCheck size={18} />
            {pending > 0 && <span className="tbadge">{pending}</span>}
          </span>
          <span className="tab-label">Approvals</span>
        </Link>
        <button type="button" className="tab" aria-label="Search" onClick={onSearch}>
          <Search size={18} />
          <span className="tab-label">Search</span>
        </button>
      </nav>
      <Sheet id="more-sheet" open={more} onClose={() => setMore(false)} title="Create or go to">
        <div className="mb-4"><EcosystemSwitcher /></div>
        <div className="mb-3 flex gap-2">
          <button className="btn btn-primary flex-1" onClick={() => { setMore(false); router.push("/pipeline"); }}>New lead</button>
          <button className="btn flex-1" onClick={() => { setMore(false); router.push("/tasks"); }}>New task</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {NAV.filter((n) => !["/dashboard", "/pipeline", "/approvals"].includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMore(false)}
              className={clsx("flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center text-xs",
                path === n.href || path.startsWith(n.href + "/") ? "border-accent/50 bg-accent/10" : "border-line bg-surface-2")}>
              <n.icon size={20} style={{ color: "var(--primary-text)" }} />
              {n.label}
            </Link>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-faint">Created by Arnold Rurangwa / Arnova Group</p>
      </Sheet>
    </>
  );
}
