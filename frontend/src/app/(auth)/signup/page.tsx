"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function SignupPage() {
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    api<{ owner_setup: boolean }>("/auth/config").then((c) => setSetup(c.owner_setup)).catch(() => setSetup(false));
  }, []);
  return (
    <>
      <Link href="/login" className="text-sm" style={{ color: "var(--text2)" }}>← Back to sign in</Link>
      <div className="mt-6 grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "var(--s2)" }}>🔒</div>
      <h1 className="mt-4 font-display text-3xl font-medium tracking-tight">Invite required</h1>
      <p className="mt-3 text-sm" style={{ color: "var(--text2)" }}>
        RAGI doesn’t have open sign-up. To get an account, ask the owner for an invite.
      </p>
      <div className="mt-6 rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--s1)" }}>
        Signing in with Google or Apple won’t create an account without an invite.
      </div>
      {setup && (
        <p className="mt-4 text-sm">Setting this instance up for the first time? <Link href="/setup" className="underline">Create the owner account</Link> with the one-time setup token.</p>
      )}
      <Link href="/login" className="btn btn-primary mt-8 flex h-12 w-full items-center justify-center">Back to sign in</Link>
    </>
  );
}
