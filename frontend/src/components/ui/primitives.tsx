"use client";
import clsx from "clsx";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-medium tracking-tight md:text-[2.5rem] md:leading-[1.1]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, delay = 0 }: { className?: string; children: ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={clsx("card p-5", className)}
    >
      {children}
    </motion.section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num mt-2 font-display text-3xl font-medium tracking-tight" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="chip" title="Generic sample data (seeded only with --with-demo)" style={{ color: "var(--arn-warning)", borderColor: "color-mix(in oklab, var(--arn-warning) 35%, transparent)" }}>
      SAMPLE
    </span>
  );
}

const TONES: Record<string, string> = {
  active: "var(--arn-positive)", up: "var(--arn-positive)", done: "var(--arn-positive)", completed: "var(--arn-positive)",
  approved: "var(--arn-positive)", won: "var(--arn-positive)", paid: "var(--arn-positive)", ok: "var(--arn-positive)", connected: "var(--arn-positive)",
  in_progress: "var(--arn-accent)", proposal: "var(--arn-accent)", pending_approval: "var(--arn-warning)", pending: "var(--arn-warning)",
  warning: "var(--arn-warning)", upcoming: "var(--arn-info)", review: "var(--arn-info)", qualified: "var(--arn-info)", handed_to_omh: "var(--arn-info)", issued: "var(--arn-info)",
  blocked: "var(--arn-danger)", down: "var(--arn-danger)", rejected: "var(--arn-danger)", lost: "var(--arn-danger)", over: "var(--arn-danger)", critical: "var(--arn-danger)",
  high: "var(--arn-warning)",
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const tone = TONES[status] ?? "var(--arn-muted)";
  return (
    <span className="chip" style={{ color: tone, borderColor: `color-mix(in oklab, ${tone} 30%, transparent)`, background: `color-mix(in oklab, ${tone} 10%, transparent)` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function Progress({ value, label = "Progress" }: { value: number; label?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: "linear-gradient(90deg, var(--arn-caramel), color-mix(in oklab, var(--arn-caramel) 60%, var(--arn-sage)))" }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center">
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="mt-1 text-xs text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function TbdNote({ gap, children }: { gap: number; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted">
      <span className="chip mr-2">TBD · spec gap #{gap}</span>
      {children}
    </div>
  );
}
