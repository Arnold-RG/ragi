"use client";
import clsx from "clsx";
import { Bot, FolderKanban, LayoutDashboard, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Sheet } from "@/components/ui/Sheet";
import { fetcher } from "@/lib/api";
import type { Summary } from "@/lib/types";
import { NAV } from "./nav";

export function MobileNavigation({ onSearch }: { onSearch?: () => void }) {
  const path = usePathname();
  const { data: s } = useSWR<Summary>("/dashboard/summary", fetcher, { refreshInterval: 60000 });
  const [more, setMore] = useState(false);
  const pending = s?.approvals.pending ?? 0;
  const tabs = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/agents", label: "Agents", icon: Bot },
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
        <button type="button" className="tab" aria-label={pending ? `More, ${pending} approvals waiting` : "More"} onClick={() => setMore(true)}>
          <span className="relative">
            <MoreHorizontal size={18} />
            {pending > 0 && <span className="tbadge">{pending}</span>}
          </span>
          <span className="tab-label">More</span>
        </button>
      </nav>
      <Sheet id="more-sheet" open={more} onClose={() => setMore(false)} title="More">
        <div className="more-grid">
          {NAV.filter((n) => !["/dashboard", "/projects", "/agents"].includes(n.href)).map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMore(false)}
              className={clsx("more-grid-item",
                path === n.href || path.startsWith(n.href + "/") ? "border-accent/50 bg-accent/10" : "border-line bg-surface-2")}>
              <span className="relative">
                <n.icon size={20} style={{ color: "var(--primary-text)" }} />
                {n.href === "/approvals" && pending > 0 && <span className="tbadge">{pending}</span>}
              </span>
              {n.label}
            </Link>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-faint">Created by Arnold Rurangwa / Arnova Group</p>
      </Sheet>
    </>
  );
}
