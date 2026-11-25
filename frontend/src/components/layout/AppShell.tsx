"use client";
import { LogOut, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api";
import { formatMinutes } from "@/lib/format";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { MobileNavigation } from "./MobileNavigation";
import { ChromeSlot } from "./PageChrome";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

interface Running { id: string; project_name: string; task_title: string | null; started_at: string }

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
    <button onClick={async () => { await api(`/time-entries/${data.id}/stop`, { method: "POST" }); mutate(null); }} className="chip min-h-10 gap-2 px-3 text-xs" style={{ color: "var(--primary-text)" }} title="Stop timer" aria-label="Stop the running timer">
      <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
      <span className="num">{formatMinutes(Math.max(mins, 0))}</span>
      <span className="hidden max-w-40 truncate sm:inline" style={{ color: "var(--text2)" }}>{data.task_title ?? data.project_name}</span>
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const rail = path.startsWith("/pipeline") || path.startsWith("/projects") || path.startsWith("/tasks");
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
    <div className={`app-shell ${rail ? "rail" : ""}`}>
      <Sidebar rail={rail} />
      <div className="flex min-w-0 flex-1 flex-col" style={{ background: "var(--bg)" }}>
        <header className="top flex flex-wrap items-center gap-3 px-4 pt-4 md:px-6 lg:px-[24px]">
          <Link href="/dashboard" className="lg:hidden"><Logo compact /></Link>
          <ChromeSlot className="flex min-w-0 flex-1 items-center gap-3" />
          <button onClick={() => setPalette(true)} className="search-field hidden md:flex" aria-label="Open search">
            <Search size={16} /> <span className="truncate">Search…</span>
            <span className="kbd ml-auto">⌘K</span>
          </button>
          <TimerPill />
          <ThemeToggle />
          <button type="button" className="btn-ghost icon-btn p-0" onClick={logout} aria-label="Sign out"><LogOut size={16} /></button>
        </header>
        <main id="main" className="dock-safe flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4 md:px-6 lg:px-[24px]">{children}</main>
      </div>
      <MobileNavigation onSearch={() => setPalette(true)} />
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}
