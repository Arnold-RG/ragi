"use client";
import { KeyRound, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface SessionState { mfa_pending: boolean; enrolment_required: boolean; email: string; role: string }

export default function VerifyPage() {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<SessionState>("/auth/session")
      .then(setState)
      .catch(() => router.replace("/login"));
  }, [router]);

  const enrol = state?.enrolment_required ?? false;

  const startSetup = async () => {
    setError(null);
    try { setSetup(await api("/auth/mfa/setup", { method: "POST" })); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not start setup"); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      if (enrol) {
        await api("/auth/mfa/enable", { json: { code } });
        router.push("/dashboard");
      } else {
        const r = await api<{ user: { role: string } }>("/auth/verify", { json: { code } });
        router.push(r.user.role === "client" ? "/portal" : "/dashboard");
      }
    } catch (err) {
      setCode("");
      setError(err instanceof ApiError ? err.message : "Could not verify");
      if (err instanceof ApiError && (err.status === 429 || err.status === 401)) setTimeout(() => router.replace("/login"), 2500);
    } finally { setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-accent/15 text-accent">{enrol ? <KeyRound size={20} /> : <ShieldCheck size={20} />}</div>
      <h2 className="font-display text-3xl font-medium tracking-tight">{enrol ? "Set up two-step sign-in" : "Verification"}</h2>
      <p className="mt-2 text-sm text-muted">
        {enrol
          ? "Owner and admin accounts must use an authenticator app before opening RAGI."
          : "Enter the 6-digit code from your authenticator app. Five wrong codes lock the account for 15 minutes."}
      </p>
      {enrol && !setup && (
        <button className="btn btn-primary mt-8 h-11 w-full" onClick={startSetup}>Generate my secret</button>
      )}
      {enrol && setup && (
        <div className="mt-6 space-y-2 rounded-2xl border border-line bg-surface-2/70 p-4">
          <div className="eyebrow">Add this key to your authenticator</div>
          <code className="num block break-all text-sm">{setup.secret}</code>
          <a className="text-xs text-accent underline" href={setup.otpauth_uri}>Open in authenticator app</a>
        </div>
      )}
      {(!enrol || setup) && (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input className="input num h-14 text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Verification code" autoFocus />
          {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <button className="btn btn-primary h-11 w-full" disabled={code.length !== 6 || busy}>{enrol ? "Turn on and continue" : "Verify"}</button>
        </form>
      )}
      {state && <p className="mt-6 text-xs text-faint">Signing in as {state.email}</p>}
    </motion.div>
  );
}
