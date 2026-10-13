const TOKEN_KEY = "ragi.session.token";
const EXP_KEY = "ragi.session.expires";
const META_KEY = "ragi.session.meta";

let memoryToken: string | null = null;

export type SessionMeta = {
  handle?: string;
  email?: string;
  mode?: "local" | "server";
};

function storage(): Storage {
  try {
    return localStorage;
  } catch {
    return sessionStorage;
  }
}

export function setToken(token: string | null, expiresAt?: string | null, meta?: SessionMeta | null) {
  memoryToken = token;
  const store = storage();
  if (token) {
    store.setItem(TOKEN_KEY, token);
    if (expiresAt) store.setItem(EXP_KEY, expiresAt);
    else store.removeItem(EXP_KEY);
    if (meta) store.setItem(META_KEY, JSON.stringify(meta));
  } else {
    store.removeItem(TOKEN_KEY);
    store.removeItem(EXP_KEY);
    store.removeItem(META_KEY);
  }
}

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  const store = storage();
  const token = store.getItem(TOKEN_KEY);
  const exp = store.getItem(EXP_KEY);
  if (exp && new Date(exp).getTime() < Date.now()) {
    clearSession();
    return null;
  }
  memoryToken = token;
  return memoryToken;
}

export function getSessionMeta(): SessionMeta | null {
  try {
    const raw = storage().getItem(META_KEY);
    return raw ? (JSON.parse(raw) as SessionMeta) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  setToken(null);
}

export function isUnlocked(): boolean {
  return Boolean(getToken());
}
