import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <div className="eyebrow mb-3">RAGI · 404</div>
        <h1 className="font-display text-4xl">This page isn&apos;t here.</h1>
        <p className="mt-3 text-sm text-muted">It may have moved, or the link is wrong.</p>
        <Link href="/dashboard" className="btn btn-primary mt-6">Back to operations</Link>
        <p className="mt-10 text-xs text-muted">Created by Arnold Rurangwa / Arnova Group</p>
      </div>
    </main>
  );
}
