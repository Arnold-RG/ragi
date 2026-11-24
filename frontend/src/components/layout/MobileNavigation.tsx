"use client";
import clsx from "clsx";
import { Ellipsis } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { EcosystemSwitcher } from "./EcosystemSwitcher";
import { MOBILE_PRIMARY, NAV } from "./nav";

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** Translucent iPhone-style bottom navigation — phones only (hidden from lg up). */
export function MobileNavigation() {
  const path = usePathname();
  // The sheet remembers which path it was opened on, so navigating closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const more = openedOn === path;
  const primary = MOBILE_PRIMARY.map((h) => NAV.find((n) => n.href === h)!);
  const rest = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href));
  const inMore = rest.some((n) => isActive(path, n.href));
  return (
    <>
      <nav
        aria-label="Primary"
        className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-stretch justify-around rounded-[26px] p-1.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] lg:hidden"
      >
        {primary.map((n) => {
          const active = isActive(path, n.href);
          return (
            <Link key={n.href} href={n.href} className="relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-xs font-medium active:scale-[0.96]" aria-current={active ? "page" : undefined}>
              {active && <motion.span layoutId="tab-active" className="absolute inset-0 rounded-[20px] bg-surface-3/80" transition={{ type: "spring", damping: 34, stiffness: 420 }} />}
              <n.icon size={21} strokeWidth={active ? 2.3 : 1.8} className="relative" style={{ color: active ? "var(--arn-accent)" : "var(--arn-muted)" }} />
              <span className={clsx("relative", active ? "text-ink" : "text-muted")}>{n.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenedOn(path)}
          className="relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-xs font-medium active:scale-[0.96]"
          aria-haspopup="dialog" aria-expanded={more} aria-controls="more-sheet" aria-current={inMore ? "page" : undefined}
        >
          {inMore && <span className="absolute inset-0 rounded-[20px] bg-surface-3/80" />}
          <Ellipsis size={21} className="relative" style={{ color: inMore ? "var(--arn-accent)" : "var(--arn-muted)" }} />
          <span className={clsx("relative", inMore ? "text-ink" : "text-muted")}>More</span>
        </button>
      </nav>
      <Sheet id="more-sheet" open={more} onClose={() => setOpenedOn(null)} title="More">
        <div className="mb-4"><EcosystemSwitcher /></div>
        <div className="grid grid-cols-3 gap-2">
          {rest.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined}
              className={clsx("flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center text-xs", isActive(path, n.href) ? "border-accent/50 bg-accent/10" : "border-line bg-surface-2")}>
              <n.icon size={20} style={{ color: "var(--arn-accent)" }} />
              {n.label}
            </Link>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-faint">Created by Arnold Rurangwa / Arnova Group</p>
      </Sheet>
    </>
  );
}
