"use client";
import { ArrowRight, Lock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api<{ mfa_required: boolean; mfa_enrolment_required: boolean; user: { role: string } | null }>("/auth/login", { json: { email, password } });
      if (r.mfa_enrolment_required) router.push("/verify?enrol=1");
      else if (r.mfa_required) router.push("/verify");
      else router.push(r.user?.role === "client" ? "/portal" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach RAGI");
    } finally { setBusy(false); }
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <h2 className="font-display text-3xl font-medium tracking-tight">Sign in</h2>
      <p className="mt-2 text-sm text-muted">This sign-in is only for RAGI. Our Money Hub has its own accounts and login.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button className="btn btn-primary h-11 w-full" disabled={busy}>
          {busy ? "Signing in…" : <>Continue <ArrowRight size={16} /></>}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5"><Lock size={12} /> Protected with two-step verification</span>
        <Link href="/recovery" className="link-hit hover:text-ink">Forgot password?</Link>
      </div>
    </motion.div>
  );
}
