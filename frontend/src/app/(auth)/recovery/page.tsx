"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

export default function RecoveryPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div>
      <h2 className="font-display text-3xl font-medium tracking-tight">Account recovery</h2>
      {sent ? (
        <p className="mt-4 text-sm text-muted">
          Request recorded. Email delivery is not connected in this build, so no message was sent — the owner can reset access from the server.
        </p>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={async (e) => { e.preventDefault(); await api("/auth/recovery", { json: { email } }).catch(() => {}); setSent(true); }}>
          <div>
            <label className="label" htmlFor="r-email">Email</label>
            <input id="r-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary h-11 w-full">Send recovery link</button>
        </form>
      )}
      <Link href="/login" className="mt-6 inline-block text-xs text-muted hover:text-ink">← Back to sign in</Link>
    </div>
  );
}
