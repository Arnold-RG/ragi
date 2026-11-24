"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ThroughputChart({ data }: { data: { day: string; completed: number; created: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: new Date(d.day + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gDone" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--arn-caramel)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--arn-caramel)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gNew" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--arn-sage)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--arn-sage)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--arn-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--arn-faint)", fontSize: 11 }} tickLine={false} axisLine={false} interval={2} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--arn-faint)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "var(--arn-surface-2)", border: "1px solid var(--arn-border-strong)", borderRadius: 12, color: "var(--arn-text)", fontSize: 12 }} />
          <Area type="monotone" dataKey="created" name="Created" stroke="var(--arn-sage)" strokeWidth={2} fill="url(#gNew)" />
          <Area type="monotone" dataKey="completed" name="Completed" stroke="var(--arn-caramel)" strokeWidth={2} fill="url(#gDone)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
