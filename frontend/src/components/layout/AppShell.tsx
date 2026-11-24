"use client";
import { LogOut, Search, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { formatMinutes } from "@/lib/format";
import { useMe } from "./AuthProvider";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { MobileNavigation } from "./MobileNavigation";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

interface Running { id: string; project_name: string; task_title: string | null; started_at: string }

/** Current time, refreshed on an interval (keeps render pure). */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function TimerPill() {
  const { data, mutate } = useSWR<Running | null>("/time-entries/running", fetcher, { refreshInterval: 30000 });
  const now = useNow(15000);
  if (!data) return null;
  const mins = Math.floor((now - new Date(data.started_at).getTime()) / 60000);
  return (
    <button onClick={async () => { await api(`/time-entries/${data.id}/stop`, { method: "POST" }); mutate(null); }} className="chip min-h-11 gap-2 px-3 text-xs" style={{ color: "var(--arn-accent)" }} title="Stop timer" aria-label="Stop the running timer">
      <span className="h-2 w-2 rounded-full bg-accent" />
      <span className="num">{formatMinutes(Math.max(mins, 0))}</span>
      <span className="hidden max-w-40 truncate text-muted sm:inline">{data.task_title ?? data.project_name}</span>
      <Square size={11} />
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const logout = async () => { await api("/auth/logout", { method: "POST" }).catch(() => {}); router.replace("/login"); };
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-x-0 border-t-0 px-4 md:px-8">
          <Link href="/dashboard" className="lg:hidden"><Logo compact /></Link>
          <button onClick={() => setPalette(true)} className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-3 text-sm text-faint md:max-w-md" aria-label="Open search">
            <Search size={16} /> <span className="truncate">Search or jump to…</span>
            <span className="ml-auto hidden gap-1 md:flex"><span className="kbd">⌘</span><span className="kbd">K</span></span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <TimerPill />
            <ThemeToggle />
            <div className="hidden items-center gap-2 pl-2 md:flex">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-3 text-xs font-semibold">{me?.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div>
              <div className="leading-tight"><div className="text-xs font-medium">{me?.full_name}</div><div className="text-xs capitalize text-faint">{me?.role}</div></div>
            </div>
            <button type="button" className="btn btn-ghost icon-btn p-0" onClick={logout} aria-label="Sign out"><LogOut size={16} /></button>
          </div>
        </header>
        <main id="main" className="dock-safe mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 md:px-8">{children}</main>
      </div>
      <MobileNavigation />
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}
