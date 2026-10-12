const TOKEN_KEY = "ragi.session.token";

let memoryToken: string | null = null;

export function setToken(token: string | null) {
  memoryToken = token;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  memoryToken = sessionStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

export function clearSession() {
  setToken(null);
}

export function isUnlocked(): boolean {
  return Boolean(getToken());
}
