"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useSecretFromFragment } from "@/lib/useSecretFromFragment";

function SetupForm() {
  const router = useRouter();
  const { secret, setSecret, ready } = useSecretFromFragment();
  const [token, setToken] = useState("");
  useEffect(() => { if (secret) setToken(secret); }, [secret]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    api<{ owner_setup: boolean }>("/auth/config").then((c) => setAvailable(c.owner_setup)).catch(() => setAvailable(false));
  }, []);

  const lengthOk = password.length >= 12 && password.length <= 128;
  const match = password.length > 0 && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lengthOk) { setError("Use a password of 12 to 128 characters."); return; }
    if (!match) { setError("Passwords don’t match. Check the last character."); return; }
    setBusy(true); setError(null);
    try {
      const r = await api<{ mfa_enrolment_required: boolean }>("/auth/register", {
        json: { setup_token: token, email, password, full_name: fullName },
      });
      router.push(r.mfa_enrolment_required ? "/verify?enrol=1" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the owner account");
    } finally { setBusy(false); }
  };

  if (available === false) {
    return (
      <>
        <h1 className="font-display text-3xl font-medium tracking-tight">Owner setup isn’t available</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--text2)" }}>This instance already has an owner, or no setup token is configured. Ask the owner for an invite.</p>
        <Link href="/login" className="btn btn-primary mt-8 flex h-12 w-full items-center justify-center">Back to sign in</Link>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="text-sm" style={{ color: "var(--text2)" }}>← Back to sign in</Link>
      <h1 className="mt-4 font-display text-3xl font-medium tracking-tight">Create the owner account</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
        This is a one-time setup for this RAGI instance. You’ll enrol two-step verification on the next screen. We never collect a password for you — you choose it here.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="token">Setup token</label>
          <input id="token" className="input" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} required minLength={32} />
          <p className="mt-1 text-xs" style={{ color: "var(--faint)" }}>The one-time token from the server environment. It is at least 32 characters.</p>
        </div>
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <input id="password" className="input pr-20" type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} maxLength={128} />
            <button type="button" className="absolute right-2 top-1/2 min-h-11 min-w-11 -translate-y-1/2 text-xs" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>{show ? "Hide" : "Show"}</button>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            <li>{lengthOk ? "✓" : "○"} 12–128 characters</li>
          </ul>
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" className="input" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {confirm && !match && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>Passwords don’t match. Check the last character.</p>}
        </div>
        {error && <p role="alert" className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</p>}
        <button className="btn btn-primary h-12 w-full" disabled={busy}>{busy ? "Creating…" : "Create owner account"}</button>
      </form>
    </>
  );
}

export default function SetupPage() {
  return <SetupForm />;
}
