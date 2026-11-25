"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useMe } from "./AuthProvider";
import { EcosystemSwitcher } from "./EcosystemSwitcher";
import { Logo } from "./Logo";
import { NAV } from "./nav";
import { fetcher } from "@/lib/api";
import type { Summary } from "@/lib/types";

export function Sidebar({ rail = false }: { rail?: boolean }) {
  const path = usePathname();
  const me = useMe();
  const { data: s } = useSWR<Summary>("/dashboard/summary", fetcher, { refreshInterval: 60000 });
  const counts: Record<string, number | undefined> = {
    "/pipeline": s?.pipeline.open,
    "/approvals": s?.approvals.pending,
    "/tasks": s?.tasks.open,
  };
  const groups = ["Workspace", "Control", "More"] as const;
  const initials = me?.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2) ?? "AR";
  return (
    <aside className={clsx("side hidden lg:flex", rail && "shrink-0")} aria-label="Workspace">
      <div className="logo px-1 pb-4"><Logo /></div>
      <div className="logo-type px-1 pb-3"><EcosystemSwitcher /></div>
      <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Main">
        {groups.map((g) => (
          <div key={g}>
            <div className="sec-label eyebrow px-3 pb-1.5 pt-3">{g}</div>
            {NAV.filter((n) => n.group === g).map((n) => {
              const active = path === n.href || path.startsWith(n.href + "/");
              const count = counts[n.href];
              return (
                <Link key={n.href} href={n.href} className={clsx("nav-link", active && "on")} aria-current={active ? "page" : undefined} title={n.label}>
                  <n.icon size={18} strokeWidth={active ? 2.3 : 1.8} />
                  <span className="logo-type">{n.label}</span>
                  {typeof count === "number" && count > 0 && <span className="cnt" aria-label={`${count} waiting`}>{count}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="me mt-auto flex items-center gap-2.5 border-t pt-3" style={{ borderColor: "var(--border)", color: "var(--side-text)" }}>
        <div className="avatar grid h-9 w-9 place-items-center rounded-[10px] text-xs font-bold" style={{ background: "var(--s3)", color: "var(--text)" }}>{initials}</div>
        <div className="me-copy min-w-0 text-xs">
          <div className="truncate font-medium">{me?.full_name}</div>
          <div className="truncate capitalize" style={{ color: "var(--side-text)" }}>{me?.role}</div>
        </div>
      </div>
      <div className="credit pt-2 text-[10.5px]" style={{ color: "var(--side-text)" }}>Created by Arnold Rurangwa / Arnova Group</div>
    </aside>
  );
}
