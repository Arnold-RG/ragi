"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface SessionState { mfa_pending: boolean; enrolment_required: boolean; email: string; role: string; recovery_remaining?: number }

export default function VerifyPage() {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<SessionState>("/auth/session").then(setState).catch(() => router.replace("/login"));
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
        const r = await api<{ recovery_codes?: string[] }>("/auth/mfa/enable", { json: { code } });
        if (r.recovery_codes?.length) { setCodes(r.recovery_codes); setBusy(false); return; }
        router.push("/dashboard");
      } else if (backup) {
        const r = await api<{ user: { role: string } }>("/auth/mfa/recovery", { json: { code } });
        router.push(r.user.role === "client" ? "/portal" : "/dashboard");
      } else {
        const r = await api<{ user: { role: string } }>("/auth/verify", { json: { code } });
        router.push(r.user.role === "client" ? "/portal" : "/dashboard");
      }
    } catch (err) {
      setCode("");
      setError(err instanceof ApiError && err.status === 429
        ? "Too many wrong codes. Sign in again later."
        : (backup ? "That backup code didn’t match" : "That code didn’t match"));
    } finally { setBusy(false); }
  };

  if (codes) {
    return (
      <>
        <h1 className="font-display text-3xl font-medium tracking-tight">Save your backup codes</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Each code works once. Store them somewhere safe — RAGI cannot email a reset.</p>
        <ul className="mt-6 grid grid-cols-2 gap-2 font-mono text-sm">
          {codes.map((c) => <li key={c} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--s2)" }}>{c}</li>)}
        </ul>
        <button className="btn btn-primary mt-8 h-12 w-full" onClick={() => router.push("/dashboard")}>I’ve saved these codes</button>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="text-sm" style={{ color: "var(--text2)" }}>← Back to sign in</Link>
      <h1 className="mt-4 font-display text-3xl font-medium tracking-tight">{enrol ? "Set up two-step verification" : "Two-step verification"}</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
        {enrol
          ? "Owner and admin accounts must use an authenticator app before opening RAGI."
          : <>Enter the 6-digit code from your authenticator app{state?.email ? <> for <b>{state.email}</b></> : ""}.</>}
      </p>
      {enrol && !setup && (
        <button className="btn btn-primary mt-8 h-12 w-full" onClick={startSetup}>Generate my secret</button>
      )}
      {enrol && setup && (
        <div className="mt-6 space-y-2 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--s2)" }}>
          <div className="eyebrow">Add this key to your authenticator</div>
          <code className="num block break-all text-sm">{setup.secret}</code>
          <a className="text-xs underline" href={setup.otpauth_uri}>Open in authenticator app</a>
        </div>
      )}
      {(!enrol || setup) && (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="otp">{backup ? "Backup code" : "Verification code"}</label>
            <input id="otp" className="input num h-14 text-center text-2xl tracking-[0.4em]"
              type="text" inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code"
              maxLength={backup ? 10 : 6} pattern={backup ? undefined : "[0-9]*"}
              value={code} onChange={(e) => setCode(backup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ""))}
              aria-invalid={!!error} aria-describedby={error ? "otp-err" : undefined} autoFocus />
            {!backup && <p className="mt-1 text-xs" style={{ color: "var(--faint)" }}>{code.length} of 6 digits entered · codes refresh every 30 seconds</p>}
          </div>
          {error && <p id="otp-err" role="alert" className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</p>}
          <button className="btn btn-primary h-12 w-full" disabled={busy || (!backup && code.length !== 6)}>{busy ? "Checking…" : "Verify"}</button>
        </form>
      )}
      {!enrol && (
        <p className="mt-4 text-sm">
          <button type="button" className="underline" onClick={() => { setBackup((v) => !v); setCode(""); setError(null); }}>
            {backup ? "Use an authenticator code" : "Use a backup code"}
          </button>
        </p>
      )}
    </>
  );
}
