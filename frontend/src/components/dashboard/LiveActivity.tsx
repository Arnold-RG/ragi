"use client";
import { Pause, Play } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { relativeTime } from "@/lib/format";
import type { Activity } from "@/lib/types";

function wsUrl() {
  if (process.env.NEXT_PUBLIC_RAGI_WS_URL) return process.env.NEXT_PUBLIC_RAGI_WS_URL;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8410/ws/operations`;
}

/**
 * Live feed: seeded from the summary, then pushed over /ws/operations (recorded audit events only).
 * WCAG 2.2.2: the user can pause updates; new items queue while paused. Reconnects with backoff.
 */
export function LiveActivity({ initial }: { initial: Activity[] }) {
  const [pushed, setPushed] = useState<Activity[]>([]);
  const [queued, setQueued] = useState<Activity[]>([]);
  const [live, setLive] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const reduce = useReducedMotion();

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const connect = () => {
      if (stopped || document.hidden) return;
      try { ws = new WebSocket(wsUrl()); } catch { return; }
      ws.onopen = () => { retry = 0; setLive(true); };
      ws.onclose = (e) => {
        setLive(false);
        if (stopped || e.code === 4401 || e.code === 4403) return; // signed out / not allowed: don't hammer
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
      };
      ws.onmessage = (m) => {
        let a: Activity;
        try { a = JSON.parse(m.data) as Activity; } catch { return; }
        if (pausedRef.current) setQueued((q) => [a, ...q].slice(0, 50));
        else setPushed((p) => [a, ...p.filter((x) => x.id !== a.id)].slice(0, 12));
      };
    };
    const onVis = () => { if (!document.hidden && (!ws || ws.readyState === WebSocket.CLOSED)) connect(); };
    connect();
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; clearTimeout(timer); ws?.close(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const resume = () => {
    setPushed((p) => [...queued, ...p].slice(0, 12));
    setQueued([]);
    setPaused(false);
  };
  const items = [...pushed, ...initial.filter((i) => !pushed.some((p) => p.id === i.id))].slice(0, 12);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <span className={`h-2 w-2 rounded-full ${live && !paused ? "bg-positive" : "bg-faint"}`} aria-hidden />
        <span>{paused ? "Paused" : live ? "Live" : "Live feed offline — showing last recorded events"}</span>
        <button type="button" className="btn btn-ghost ml-auto min-h-11 px-2 text-xs" aria-pressed={paused} onClick={() => (paused ? resume() : setPaused(true))}>
          {paused ? <><Play size={13} /> Resume{queued.length ? ` (${queued.length} new)` : ""}</> : <><Pause size={13} /> Pause updates</>}
        </button>
      </div>
      <ol className="relative space-y-3 border-l border-line pl-4" aria-live={paused ? "off" : "polite"} aria-relevant="additions">
        <AnimatePresence initial={false}>
          {items.map((a) => (
            <motion.li key={a.id} layout={!reduce} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="relative">
              <span className="absolute -left-[1.32rem] top-1.5 h-2 w-2 rounded-full bg-accent ring-4 ring-[var(--arn-surface)]" />
              <div className="text-sm">{a.summary ?? a.action}</div>
              <div className="text-xs text-muted">{a.actor} · {relativeTime(a.at)}</div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
