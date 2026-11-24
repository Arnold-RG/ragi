"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <div className="eyebrow mb-3">RAGI</div>
        <h1 className="font-display text-4xl">Something went wrong.</h1>
        <p className="mt-3 text-sm text-muted">Nothing was changed. Try again.</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-6">Try again</button>
      </div>
    </main>
  );
}
