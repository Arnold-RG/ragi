const TOKEN_KEY = "ragi.session.token";
const EXP_KEY = "ragi.session.expires";
const META_KEY = "ragi.session.meta";
const REMEMBER_KEY = "ragi.session.remember";

let memoryToken: string | null = null;

export type SessionMeta = {
  handle?: string;
  email?: string;
  mode?: "local" | "server";
};

function preferRemember(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setRememberMe(on: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getRememberMe(): boolean {
  return preferRemember();
}

function durableStore(): Storage {
  try {
    return preferRemember() ? localStorage : sessionStorage;
  } catch {
    return sessionStorage;
  }
}

function clearBoth() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      store.removeItem(TOKEN_KEY);
      store.removeItem(EXP_KEY);
      store.removeItem(META_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function setToken(token: string | null, expiresAt?: string | null, meta?: SessionMeta | null) {
  memoryToken = token;
  clearBoth();
  if (!token) return;
  const store = durableStore();
  store.setItem(TOKEN_KEY, token);
  if (expiresAt) store.setItem(EXP_KEY, expiresAt);
  if (meta) store.setItem(META_KEY, JSON.stringify(meta));
}

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  for (const store of [localStorage, sessionStorage]) {
    try {
      const token = store.getItem(TOKEN_KEY);
      const exp = store.getItem(EXP_KEY);
      if (exp && new Date(exp).getTime() < Date.now()) {
        store.removeItem(TOKEN_KEY);
        store.removeItem(EXP_KEY);
        store.removeItem(META_KEY);
        continue;
      }
      if (token) {
        memoryToken = token;
        return memoryToken;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function getSessionMeta(): SessionMeta | null {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(META_KEY);
      if (raw) return JSON.parse(raw) as SessionMeta;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function clearSession() {
  memoryToken = null;
  clearBoth();
}

export function isUnlocked(): boolean {
  return Boolean(getToken());
}
