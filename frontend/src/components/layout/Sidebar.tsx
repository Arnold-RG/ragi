"use client";
import clsx from "clsx";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EcosystemSwitcher } from "./EcosystemSwitcher";
import { Logo } from "./Logo";
import { NAV } from "./nav";

export function Sidebar() {
  const path = usePathname();
  const groups = ["Operate", "Studio", "Intelligence", "Control"] as const;
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-3 py-5 lg:flex">
      <div className="px-2"><Logo /></div>
      <div className="mt-5 px-1"><EcosystemSwitcher /></div>
      <nav className="mt-5 flex-1 space-y-5 overflow-y-auto" aria-label="Main">
        {groups.map((g) => (
          <div key={g}>
            <div className="eyebrow px-3 pb-1.5">{g}</div>
            {NAV.filter((n) => n.group === g).map((n) => {
              const active = path === n.href || path.startsWith(n.href + "/");
              return (
                <Link key={n.href} href={n.href} className={clsx("relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors", active ? "text-ink" : "text-muted hover:text-ink")}>
                  {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-surface-2 ring-1 ring-line" transition={{ type: "spring", damping: 30, stiffness: 400 }} />}
                  <n.icon size={17} className="relative" style={active ? { color: "var(--arn-accent)" } : undefined} />
                  <span className="relative">{n.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-3 pt-4 text-xs leading-relaxed text-faint">
        Created by Arnold Rurangwa / Arnova Group
      </div>
    </aside>
  );
}
