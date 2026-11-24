export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl" style={{ background: "linear-gradient(135deg, var(--arn-caramel), var(--arn-brown) 55%, var(--arn-forest))" }}>
        <span className="font-display text-lg font-semibold text-cream">R</span>
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[1.05rem] font-semibold tracking-tight">RAGI</div>
          <div className="text-xs uppercase tracking-[0.18em] text-faint">Arnova Group</div>
        </div>
      )}
    </div>
  );
}
