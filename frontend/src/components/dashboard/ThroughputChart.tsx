"use client";

/** Stacked bars: completed (c1) and opened (created) as a second series. Word legend lives with the parent. */
export function ThroughputChart({ data }: { data: { day: string; completed: number; created: number }[] }) {
  const rows = data.map((d) => ({
    ...d,
    label: new Date(d.day + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  }));
  const max = Math.max(1, ...rows.map((r) => r.completed + Math.max(0, r.created - r.completed)));
  const h = 156;
  const w = Math.max(320, rows.length * 36);
  const barW = 16;
  const gap = (w - 24) / rows.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 24}`} width="100%" height={h + 24} role="img" aria-label="Task throughput for the last 14 days">
      {rows.map((r, i) => {
        const x = 12 + i * gap + (gap - barW) / 2;
        const opened = Math.max(0, r.created);
        const doneH = (r.completed / max) * h;
        const rest = Math.max(0, opened - r.completed);
        const restH = (rest / max) * h;
        return (
          <g key={r.day}>
            <rect x={x} y={h - doneH} width={barW} height={doneH} rx="3" fill="var(--c1)">
              <title>{`${r.label}: ${r.completed} completed, ${r.created} opened`}</title>
            </rect>
            {restH > 0 && <rect x={x} y={h - doneH - restH} width={barW} height={restH} rx="3" fill="var(--danger)" />}
            {i % 2 === 0 && <text x={x + barW / 2} y={h + 16} textAnchor="middle" fill="var(--text2)" fontSize="10.5">{r.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
