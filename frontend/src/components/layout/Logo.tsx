export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="mono-mark" aria-hidden>R</div>
      {!compact && (
        <div className="logo-type leading-tight">
          <b className="block text-[15px] font-bold leading-tight" style={{ color: "var(--side-text)", filter: "brightness(1.25)" }}>RAGI</b>
          <small className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--side-text)" }}>Arnova Group</small>
        </div>
      )}
    </div>
  );
}
