"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useSecretFromFragment } from "@/lib/useSecretFromFragment";

const GENERIC = "This invite can’t be used. Ask the owner for a new one.";

interface Preview { email: string; role: string; expires_at: string; ttl_hours: number; single_use: boolean }

export default function InvitePage() {
  const router = useRouter();
  const { secret, ready } = useSecretFromFragment();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api<Preview>("/auth/invite/preview", { json: secret ? { token: secret } : {} });
        if (!cancelled) setPreview(p);
      } catch {
        if (!cancelled) setError(GENERIC);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, secret]);

  const lengthOk = password.length >= 12 && password.length <= 128;
  const match = password.length > 0 && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    if (!lengthOk) { setError("Use a password of 12 to 128 characters."); return; }
    if (!match) { setError("Passwords don’t match. Check the last character."); return; }
    setBusy(true); setError(null);
    try {
      const r = await api<{ mfa_enrolment_required?: boolean }>("/auth/register", {
        json: { email: preview.email, password, full_name: fullName, invite_token: secret || undefined },
      });
      router.push(r.mfa_enrolment_required ? "/verify?enrol=1" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409
        ? "An account with this email already exists"
        : GENERIC);
    } finally { setBusy(false); }
  };

  if (loading) return <p className="text-sm">Checking this invite…</p>;

  if (!preview) {
    return (
      <>
        <h1 className="font-display text-3xl font-medium tracking-tight">This invite can’t be used</h1>
        <p role="alert" className="mt-3 text-sm" style={{ color: "var(--text2)" }}>{GENERIC}</p>
        <Link href="/login" className="btn btn-primary mt-8 flex h-12 w-full items-center justify-center">Back to sign in</Link>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="text-sm" style={{ color: "var(--text2)" }}>← Back to sign in</Link>
      <h1 className="mt-4 font-display text-3xl font-medium tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
        This invite is for <b>{preview.email}</b> as <b>{preview.role}</b>. It lasts 72 hours and can be used once.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" value={preview.email} readOnly autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <input id="password" className="input pr-20" type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} maxLength={128} />
            <button type="button" className="absolute right-2 top-1/2 min-h-11 min-w-11 -translate-y-1/2 text-xs" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>{show ? "Hide" : "Show"}</button>
          </div>
          <p className="mt-1 text-xs">{lengthOk ? "✓" : "○"} 12–128 characters</p>
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" className="input" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <p role="alert" className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</p>}
        <button className="btn btn-primary h-12 w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>
    </>
  );
}
