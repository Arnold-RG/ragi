import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line p-12 lg:flex lg:flex-col">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 500px at 20% 10%, rgba(195,141,88,0.28), transparent 60%), radial-gradient(700px 500px at 90% 90%, rgba(25,63,48,0.55), transparent 60%)" }} />
        <Logo />
        <div className="mt-auto max-w-lg">
          <div className="eyebrow mb-4">Arnova Group · Operations engine</div>
          <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-tight">Everything you build, manage and operate.</h1>
          <p className="mt-5 text-muted">Pipeline, projects, tasks, time, approvals, retainers and your AI team — one calm, owner-controlled command surface for the studio.</p>
        </div>
        <div className="mt-12 text-xs text-faint">Created by Arnold Rurangwa / Arnova Group</div>
      </section>
      <section className="flex flex-col items-center justify-center px-5 py-12">
        <div className="mb-10 lg:hidden"><Logo /></div>
        <div className="w-full max-w-sm">{children}</div>
        <div className="mt-10 text-xs text-faint lg:hidden">Created by Arnold Rurangwa / Arnova Group</div>
      </section>
    </div>
  );
}
