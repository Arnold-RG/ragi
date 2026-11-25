"use client";
import { CheckCircle2, CircleDashed, Lock, ShieldCheck } from "lucide-react";
import useSWR from "swr";
import { useMe } from "@/components/layout/AuthProvider";
import { setTheme, useTheme } from "@/components/layout/ThemeToggle";
import { Card, CardTitle, PageHeader, Skeleton, TbdNote } from "@/components/ui/primitives";
import { fetcher } from "@/lib/api";
import type { Summary } from "@/lib/types";

interface Integration { id: string; name: string; kind: string; connected: boolean; detail: string }

export default function SettingsPage() {
  const me = useMe();
  const theme = useTheme();
  const { data: s } = useSWR<Summary>("/dashboard/summary", fetcher);
  const { data: ints } = useSWR<{ items: Integration[] }>("/integrations", fetcher);
  const switches = s ? [
    { name: "AI agents", on: s.safety.agents_enabled, env: "AGENTS_ENABLED" },
    { name: "Repository writes", on: s.safety.repository_writes_enabled, env: "REPOSITORY_WRITES_ENABLED" },
    { name: "Production deployments", on: s.safety.production_deployment_enabled, env: "PRODUCTION_DEPLOYMENT_ENABLED" },
  ] : [];
  return (
    <>
      <PageHeader eyebrow="Control" title="Settings" subtitle="Your account, appearance, safety switches and connections." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Account</CardTitle>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Name</dt><dd>{me?.full_name}</dd>
            <dt className="text-muted">Email</dt><dd>{me?.email}</dd>
            <dt className="text-muted">Role</dt><dd className="capitalize">{me?.role}</dd>
            <dt className="text-muted">Two-step sign-in</dt><dd className="flex items-center gap-1.5">{me?.mfa_enabled ? <><ShieldCheck size={14} className="text-positive" /> On</> : "Off"}</dd>
          </dl>
          <p className="mt-4 text-sm text-muted">RAGI and Our Money Hub keep separate accounts and sessions. There is no shared sign-in.</p>
        </Card>
        <Card delay={0.05}>
          <CardTitle>Appearance</CardTitle>
          <div className="flex gap-2" role="radiogroup" aria-label="Theme">
            {(["dark", "light"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={theme === t} onClick={() => setTheme(t)} className={`btn flex-1 capitalize ${theme === t ? "border-accent/60 bg-accent/15" : ""}`}>{t}</button>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">Appearance follows the Sky ops look you picked: navy with Pastel dawn sky, in dark and light.</p>
        </Card>
        <Card delay={0.1}>
          <CardTitle>Safety switches</CardTitle>
          {!s ? <Skeleton className="h-24" /> : (
            <ul className="space-y-3 text-sm">
              {switches.map((w) => (
                <li key={w.env} className="flex items-center justify-between gap-3">
                  <div><div>{w.name}</div><code className="text-xs text-muted">{w.env}</code></div>
                  <span className="chip" style={{ color: w.on ? "var(--arn-positive)" : "var(--arn-danger)" }}><Lock size={11} /> {w.on ? "on" : "off"}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">Switches are set on the server only, never from the browser.</p>
          <div className="mt-3"><TbdNote gap={19}>Who may flip the emergency stop, and how, is your decision.</TbdNote></div>
        </Card>
        <Card delay={0.15}>
          <CardTitle>Connections</CardTitle>
          {!ints ? <Skeleton className="h-32" /> : (
            <ul className="space-y-3 text-sm">
              {ints.items.map((i) => (
                <li key={i.id} className="flex items-start gap-3">
                  {i.connected ? <CheckCircle2 size={16} className="mt-0.5 text-positive" /> : <CircleDashed size={16} className="mt-0.5 text-muted" />}
                  <div><div>{i.name}</div><div className="text-xs text-muted">{i.detail}</div></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="mt-8 text-center text-xs text-muted">RAGI v2 · Created by Arnold Rurangwa / Arnova Group</p>
    </>
  );
}
