"use client";
import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { NAV } from "./nav";

interface Result { type: string; id: string; title: string; subtitle: string; href: string }

/** ⌘K palette. Mounted only while open, so its state starts fresh each time. Native <dialog> = real focus trap. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; results: Result[] }>({ q: "", results: [] });
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const t = setTimeout(() => {
      api<{ results: Result[] }>(`/search?q=${encodeURIComponent(term)}`)
        .then((r) => setFound({ q: term, results: r.results }))
        .catch(() => setFound({ q: term, results: [] }));
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo(() => {
    const results = q.trim() && found.q === q.trim() ? found.results : [];
    const nav = NAV.filter((n) => !q || n.label.toLowerCase().includes(q.toLowerCase())).map((n) => ({ type: "go to", id: n.href, title: n.label, subtitle: "", href: n.href }));
    return [...results, ...nav].slice(0, 12);
  }, [q, found]);

  const go = (r: Result) => { onClose(); router.push(r.href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === "Enter" && items[sel]) go(items[sel]);
  };

  return (
    <dialog ref={ref} aria-label="Command palette" className="sheet" style={{ marginTop: "12dvh", marginBottom: "auto" }}
      onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet-panel glass mx-3 overflow-hidden rounded-2xl shadow-2xl md:mx-0">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={17} className="text-muted" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey}
            placeholder="Search projects, tasks, clients, agents… or jump to a page"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-faint" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="palette-list" />
          <span className="kbd">esc</span>
        </div>
        <ul id="palette-list" className="max-h-[50dvh] overflow-y-auto p-2" role="listbox">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches “{q}”.</li>}
          {items.map((r, i) => (
            <li key={r.type + r.id} role="option" aria-selected={i === sel}>
              <button type="button" onMouseEnter={() => setSel(i)} onClick={() => go(r)} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${i === sel ? "bg-surface-3" : ""}`}>
                <span className="chip w-16 justify-center">{r.type}</span>
                <span className="flex-1 truncate">{r.title}</span>
                {r.subtitle && <span className="truncate text-xs text-muted">{r.subtitle}</span>}
                {i === sel && <CornerDownLeft size={14} className="text-muted" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
