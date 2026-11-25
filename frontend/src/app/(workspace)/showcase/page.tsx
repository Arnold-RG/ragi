"use client";
import { ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Empty, PageHeader, Skeleton, StatusChip } from "@/components/ui/primitives";
import { fetcher } from "@/lib/api";

interface Site {
  name: string; slug: string; repo: string; live_url: string; final_url?: string;
  status: number; kind: string; group: string; embeddable: boolean;
  embeddable_label?: string; embed_notes?: string; notes?: string;
}

interface Catalog {
  title: string; subtitle: string; sites: Site[];
  summary: { live_sites: number; embeddable: number; open_in_new_tab: number; client_demos: number };
  client_demos: unknown[];
}

const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1280, icon: Monitor },
  { id: "tablet", label: "Tablet", width: 768, icon: Tablet },
  { id: "phone", label: "Phone", width: 390, icon: Smartphone },
] as const;

const IFRAME_ALLOW = "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'; fullscreen 'none'";
const SANDBOX = "allow-scripts";  // never allow-same-origin; no forms or popups
const TIMEOUT_MS = 15000;

function monogram(name: string) {
  const parts = name.replace(/https?:\/\//, "").split(/[\s/_-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "S").toUpperCase();
}

export default function ShowcasePage() {
  const { data, error } = useSWR<Catalog>("/showcase/sites", fetcher);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const [open, setOpen] = useState<Site | null>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [frame, setFrame] = useState<"loading" | "ready" | "error" | "timeout">("loading");
  const loadGen = useRef(0);

  const sites = data?.sites ?? [];
  const groups = useMemo(() => {
    const g = new Map<string, number>();
    for (const s of sites) g.set(s.group, (g.get(s.group) ?? 0) + 1);
    return [["All", sites.length] as const, ...[...g.entries()].map(([k, v]) => [k, v] as const)];
  }, [sites]);

  const filtered = sites.filter((s) => {
    if (group !== "All" && s.group !== group) return false;
    if (!q) return true;
    const hay = `${s.name} ${s.slug} ${s.notes ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const width = DEVICES.find((d) => d.id === device)?.width ?? 1280;
  const url = open ? (open.final_url || open.live_url) : "";

  const startLoad = (site: Site) => {
    const gen = ++loadGen.current;
    setOpen(site);
    setFrame(site.embeddable ? "loading" : "error");
    if (site.embeddable) {
      window.setTimeout(() => {
        if (loadGen.current === gen) setFrame((cur) => (cur === "loading" ? "timeout" : cur));
      }, TIMEOUT_MS);
    }
  };

  return (
    <>
      <PageHeader
        title="Showcase"
        subtitle={data?.subtitle ?? "Repositories · Arnold-RG"}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {groups.map(([g, n]) => (
          <button key={g} className={`chip ${group === g ? "on" : ""}`} onClick={() => setGroup(g)}>{g} {n}</button>
        ))}
        <input className="input ml-auto max-w-xs" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search showcase" />
      </div>

      {data && data.summary.client_demos === 0 && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-dashed p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--s1)" }}>
          <div>
            <b>Client demos · 0</b>
            <p className="m-0 mt-1 text-xs" style={{ color: "var(--text2)" }}>No client demos yet. When a client project ships a preview link, it appears here.</p>
          </div>
        </div>
      )}

      {!data && !error && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-48" />)}</div>}
      {error && <Empty title="Could not load the gallery">Try again in a moment.</Empty>}
      {data && filtered.length === 0 && <Empty title="No sites in this filter">Try another group or search.</Empty>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((s) => (
          <button key={s.live_url} type="button" onClick={() => startLoad(s)}
            className="card flex flex-col overflow-hidden p-0 text-left" style={{ background: "var(--s1)" }}>
            <div className="relative grid h-28 place-items-center" style={{ background: "var(--s2)" }} aria-hidden="true">
              {/* Placeholder monogram only — never a live capture of the third-party page (prices must not appear). */}
              <span className="grid size-12 place-items-center rounded-2xl text-lg font-bold" style={{ background: "var(--s3)" }}>{monogram(s.slug || s.name)}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <b className="text-sm leading-snug">{s.slug || s.name}</b>
              <p className="m-0 line-clamp-2 text-xs" style={{ color: "var(--text2)" }}>{s.notes || s.name}</p>
              <div className="mt-auto flex items-center gap-2 text-xs">
                <StatusChip status={s.status === 200 ? "up" : "down"} />
                <span className="faint">{s.group}</span>
                <span className="ml-auto" style={{ color: "var(--accent)" }}>{s.embeddable ? "Preview" : "Open"} →</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg)" }} role="dialog" aria-modal="true" aria-label={`Showcase · ${open.slug || open.name}`}>
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <button className="btn" onClick={() => setOpen(null)} aria-label="Back to gallery">Back</button>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", background: "var(--s2)" }}>
              <span className="truncate">{url}</span>
            </div>
            {DEVICES.map((d) => (
              <button key={d.id} className={`btn ${device === d.id ? "btn-primary" : ""}`} aria-pressed={device === d.id} onClick={() => setDevice(d.id)} aria-label={d.label}>
                <d.icon size={16} />
              </button>
            ))}
            <a className="btn" href={url} target="_blank" rel="noopener noreferrer">Open in new tab <ExternalLink size={14} /></a>
          </div>
          <div className="flex flex-1 justify-center overflow-auto p-4" style={{ background: "var(--s2)" }}>
            {!open.embeddable || frame === "error" ? (
              <div className="card m-auto max-w-md p-6 text-center" role="alert">
                <h3 className="m-0 text-lg font-semibold">{open.embeddable ? "This preview didn’t load" : "This site can’t be embedded"}</h3>
                <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
                  {open.embed_notes || "The site blocked embedding. Open it in a new tab instead."}
                </p>
                <a className="btn btn-primary mt-4 inline-flex" href={url} target="_blank" rel="noopener noreferrer">Open in new tab</a>
              </div>
            ) : frame === "timeout" ? (
              <div className="card m-auto max-w-md p-6 text-center" role="alert">
                <h3 className="m-0 text-lg font-semibold">This site is taking too long</h3>
                <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>No response after 15 seconds. The site or your connection may be slow.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button className="btn btn-primary" onClick={() => startLoad(open)}>Try again</button>
                  <button className="btn" onClick={() => setFrame("loading")}>Keep waiting</button>
                  <a className="btn" href={url} target="_blank" rel="noopener noreferrer">Open in new tab</a>
                </div>
              </div>
            ) : (
              <div className="relative" style={{ width: device === "desktop" ? "100%" : width, maxWidth: "100%" }}>
                {frame === "loading" && (
                  <div className="absolute inset-0 z-10 grid place-items-center rounded-xl" style={{ background: "var(--s1)" }} role="status" aria-busy="true">
                    Loading {open.slug || open.name}… <span className="faint">usually a few seconds</span>
                  </div>
                )}
                <iframe
                  title={`Demo preview: ${open.slug || open.name} (third-party site)`}
                  src={url}
                  sandbox={SANDBOX}
                  referrerPolicy="no-referrer"
                  allow={IFRAME_ALLOW}
                  loading="lazy"
                  onLoad={() => setFrame((cur) => (cur === "timeout" ? cur : "ready"))}
                  onError={() => setFrame("error")}
                  className="h-[70vh] w-full rounded-xl border-0 bg-white"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
