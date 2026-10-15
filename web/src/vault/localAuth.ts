/**
 * Device-local sealed accounts (IndexedDB + Web Crypto).
 * Used when the public Pages build has no account API.
 * Passwords are never stored — only PBKDF2 hashes. Recovery keys are hashed the same way.
 */

const DB_NAME = "ragi-vault";
const DB_VERSION = 2;
const STORE = "accounts";
const SESS = "sessions";
const LOCKS = "locks";
const ITERATIONS = 310_000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export class LocalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalAuthError";
  }
}

export type LocalSession = {
  token: string;
  accountId: string;
  handle: string;
  email: string;
  expiresAt: string;
};

type AccountRow = {
  id: string;
  email: string;
  handle: string;
  passwordSalt: string;
  passwordHash: string;
  recoverySalt: string;
  recoveryHash: string;
  createdAt: string;
  updatedAt: string;
};

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const accounts = db.createObjectStore(STORE, { keyPath: "id" });
        accounts.createIndex("email", "email", { unique: true });
        accounts.createIndex("handle", "handle", { unique: true });
      }
      if (!db.objectStoreNames.contains(SESS)) {
        db.createObjectStore(SESS, { keyPath: "token" });
      }
      if (!db.objectStoreNames.contains(LOCKS)) {
        db.createObjectStore(LOCKS, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("vault_open_failed"));
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("vault_req_failed"));
  });
}

async function getByIndex(index: "email" | "handle", value: string): Promise<AccountRow | undefined> {
  const db = await openDb();
  return idbReq(db.transaction(STORE, "readonly").objectStore(STORE).index(index).get(value));
}

async function getAccount(id: string): Promise<AccountRow | undefined> {
  const db = await openDb();
  return idbReq(db.transaction(STORE, "readonly").objectStore(STORE).get(id));
}

async function putAccount(row: AccountRow): Promise<void> {
  const db = await openDb();
  await idbReq(db.transaction(STORE, "readwrite").objectStore(STORE).put(row));
}

async function putSession(session: LocalSession): Promise<void> {
  const db = await openDb();
  await idbReq(db.transaction(SESS, "readwrite").objectStore(SESS).put(session));
}

async function getSession(token: string): Promise<LocalSession | undefined> {
  const db = await openDb();
  return idbReq(db.transaction(SESS, "readonly").objectStore(SESS).get(token));
}

async function deleteSession(token: string): Promise<void> {
  const db = await openDb();
  await idbReq(db.transaction(SESS, "readwrite").objectStore(SESS).delete(token));
}

type LockRow = { key: string; fails: number; lockedUntil: number };

async function readLock(key: string): Promise<LockRow> {
  const db = await openDb();
  const row = await idbReq<LockRow | undefined>(
    db.transaction(LOCKS, "readonly").objectStore(LOCKS).get(key),
  );
  return row ?? { key, fails: 0, lockedUntil: 0 };
}

async function writeLock(row: LockRow): Promise<void> {
  const db = await openDb();
  await idbReq(db.transaction(LOCKS, "readwrite").objectStore(LOCKS).put(row));
}

async function assertNotLocked(key: string): Promise<void> {
  const row = await readLock(key);
  if (row.lockedUntil > Date.now()) {
    const mins = Math.max(1, Math.ceil((row.lockedUntil - Date.now()) / 60_000));
    throw new LocalAuthError(`Too many attempts. Wait about ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
}

async function registerAuthFail(key: string): Promise<void> {
  const row = await readLock(key);
  row.fails += 1;
  if (row.fails >= MAX_FAILS) {
    row.lockedUntil = Date.now() + LOCK_MS;
    row.fails = 0;
  }
  await writeLock(row);
}

async function clearAuthFails(key: string): Promise<void> {
  await writeLock({ key, fails: 0, lockedUntil: 0 });
}

async function deriveHash(secret: string, saltB64: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const salt = fromB64(saltB64);
  const saltCopy = new Uint8Array(salt.byteLength);
  saltCopy.set(salt);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltCopy,
      iterations: ITERATIONS,
    },
    keyMaterial,
    256,
  );
  return b64(bits);
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  const ab = fromB64(a);
  const bb = fromB64(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

const RESERVED = new Set(["admin", "owner", "root", "ragi", "support", "api", "system"]);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase();
}

function validateRegister(input: { email: string; handle: string; password: string }) {
  const email = normalizeEmail(input.email);
  const handle = normalizeHandle(input.handle);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new LocalAuthError("Enter a valid email.");
  }
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(handle)) {
    throw new LocalAuthError("Use letters, numbers, and hyphens, and start with a letter.");
  }
  if (RESERVED.has(handle)) throw new LocalAuthError("That name is already in use.");
  if (input.password.length < 12) throw new LocalAuthError("Use at least 12 characters.");
  if (input.password.length > 128) throw new LocalAuthError("That password is too long.");
  const lower = input.password.toLowerCase();
  if (lower === email || lower === handle) {
    throw new LocalAuthError("Don't use your email or name as the password.");
  }
  return { email, handle };
}

function makeRecoveryKey(): string {
  const raw = b64(randomBytes(18));
  return `RAGI-${raw.slice(0, 8)}-${raw.slice(8, 16)}-${raw.slice(16, 24)}`.toUpperCase();
}

async function issueSession(account: AccountRow): Promise<LocalSession> {
  const token = `local.${b64(randomBytes(32))}`;
  const session: LocalSession = {
    token,
    accountId: account.id,
    handle: account.handle,
    email: account.email,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  };
  await putSession(session);
  return session;
}

export async function localRegister(input: {
  email: string;
  handle: string;
  password: string;
}): Promise<LocalSession & { recoveryKey: string }> {
  const { email, handle } = validateRegister(input);
  if (await getByIndex("email", email)) {
    throw new LocalAuthError("An account with that email already exists.");
  }
  if (await getByIndex("handle", handle)) {
    throw new LocalAuthError("That name is already in use.");
  }

  const passwordSalt = b64(randomBytes(16));
  const recoverySalt = b64(randomBytes(16));
  const recoveryKey = makeRecoveryKey();
  const now = new Date().toISOString();
  const row: AccountRow = {
    id: `acc_${b64(randomBytes(12))}`,
    email,
    handle,
    passwordSalt,
    passwordHash: await deriveHash(input.password, passwordSalt),
    recoverySalt,
    recoveryHash: await deriveHash(recoveryKey, recoverySalt),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putAccount(row);
  } catch {
    if (await getByIndex("email", email)) {
      throw new LocalAuthError("An account with that email already exists.");
    }
    throw new LocalAuthError("That name is already in use.");
  }

  const session = await issueSession(row);
  return { ...session, recoveryKey };
}

export async function localLogin(input: {
  email: string;
  password: string;
}): Promise<LocalSession> {
  const email = normalizeEmail(input.email);
  const lockKey = `login:${email}`;
  await assertNotLocked(lockKey);
  const account = await getByIndex("email", email);
  const salt = account?.passwordSalt ?? b64(randomBytes(16));
  const hash = await deriveHash(input.password, salt);
  if (!account || !(await timingSafeEqual(hash, account.passwordHash))) {
    await registerAuthFail(lockKey);
    throw new LocalAuthError("Email or password is not right.");
  }
  await clearAuthFails(lockKey);
  return issueSession(account);
}

export async function localResetPassword(input: {
  email: string;
  recoveryKey: string;
  newPassword: string;
}): Promise<LocalSession> {
  const email = normalizeEmail(input.email);
  const lockKey = `reset:${email}`;
  await assertNotLocked(lockKey);
  if (input.newPassword.length < 12) throw new LocalAuthError("Use at least 12 characters.");
  const account = await getByIndex("email", email);
  if (!account) {
    await registerAuthFail(lockKey);
    throw new LocalAuthError("No account matches that email and recovery key.");
  }
  const ok = await timingSafeEqual(
    await deriveHash(input.recoveryKey.trim().toUpperCase(), account.recoverySalt),
    account.recoveryHash,
  );
  if (!ok) {
    await registerAuthFail(lockKey);
    throw new LocalAuthError("No account matches that email and recovery key.");
  }

  const passwordSalt = b64(randomBytes(16));
  account.passwordSalt = passwordSalt;
  account.passwordHash = await deriveHash(input.newPassword, passwordSalt);
  account.updatedAt = new Date().toISOString();
  await putAccount(account);
  await clearAuthFails(lockKey);
  await clearAuthFails(`login:${email}`);
  return issueSession(account);
}

export async function localChangePassword(input: {
  token: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  if (input.newPassword.length < 12) throw new LocalAuthError("Use at least 12 characters.");
  const session = await readLocalSession(input.token);
  if (!session) throw new LocalAuthError("Sign in again to change your password.");
  const account = await getAccount(session.accountId);
  if (!account) throw new LocalAuthError("Account not found.");
  const ok = await timingSafeEqual(
    await deriveHash(input.currentPassword, account.passwordSalt),
    account.passwordHash,
  );
  if (!ok) throw new LocalAuthError("Current password is not right.");
  const passwordSalt = b64(randomBytes(16));
  account.passwordSalt = passwordSalt;
  account.passwordHash = await deriveHash(input.newPassword, passwordSalt);
  account.updatedAt = new Date().toISOString();
  await putAccount(account);
}

export async function readLocalSession(token: string | null | undefined): Promise<LocalSession | null> {
  if (!token?.startsWith("local.")) return null;
  const session = await getSession(token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await deleteSession(token);
    return null;
  }
  return session;
}

export async function localLogout(token: string | null | undefined): Promise<void> {
  if (token?.startsWith("local.")) await deleteSession(token);
}

export function isLocalToken(token: string | null | undefined): boolean {
  return Boolean(token?.startsWith("local."));
}

export async function localMe(token: string): Promise<{ handle: string; email: string; mode: string }> {
  const session = await readLocalSession(token);
  if (!session) throw new LocalAuthError("Session expired. Sign in again.");
  return { handle: session.handle, email: session.email, mode: "work" };
}
