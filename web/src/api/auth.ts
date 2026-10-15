import { api, pageCanReachApi } from "./client";
import { getToken, setToken } from "../state/session";
import {
  isLocalToken,
  localChangePassword,
  localLogin,
  localLogout,
  localMe,
  localOpenWorkspace,
  localRegister,
  localResetPassword,
  LocalAuthError,
} from "../vault/localAuth";

export type Challenge = { challengeId: string; expiresInSeconds: number };

export type AuthSession = {
  ok: boolean;
  token: string;
  expiresAt: string;
  handle: string;
  recoveryKey?: string;
  mode: "local" | "server";
};

function asAuthError(err: unknown): Error {
  if (err instanceof LocalAuthError) return err;
  return err instanceof Error ? err : new Error("The vault could not open.");
}

/** Open the on-device workspace with no login form. */
export async function openWorkspaceSession(): Promise<AuthSession> {
  const res = await localOpenWorkspace();
  const session: AuthSession = {
    ok: true,
    token: res.token,
    expiresAt: res.expiresAt,
    handle: res.handle,
    mode: "local",
  };
  setToken(session.token, session.expiresAt, {
    handle: session.handle,
    email: res.email,
    mode: "local",
  });
  return session;
}

export function startChallenge() {
  return api<Challenge>("/api/v1/auth/challenge", {
    method: "POST",
    body: "{}",
    auth: false,
  });
}

export function gate1(challengeId: string, passphrase: string) {
  return api<{ ok: boolean; next: string; gates: string[] }>("/api/v1/auth/gate/1", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ challengeId, passphrase }),
  });
}

export function gate2(challengeId: string, code: string) {
  return api<{ ok: boolean; next: string; gates: string[] }>("/api/v1/auth/gate/2", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ challengeId, code }),
  });
}

export function gate3(challengeId: string, deviceKey: string) {
  return api<{ ok: boolean; token: string; gates: string[]; expiresAt: string }>(
    "/api/v1/auth/gate/3",
    {
      method: "POST",
      auth: false,
      body: JSON.stringify({ challengeId, deviceKey }),
    },
  );
}

export async function registerAccount(input: {
  email: string;
  handle: string;
  password: string;
}): Promise<AuthSession> {
  if (pageCanReachApi()) {
    try {
      const res = await api<{
        ok: boolean;
        token: string;
        expiresAt: string;
        handle: string;
        recoveryKey?: string;
      }>("/api/v1/auth/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify(input),
      });
      const session: AuthSession = {
        ok: true,
        token: res.token,
        expiresAt: res.expiresAt,
        handle: res.handle,
        recoveryKey: res.recoveryKey,
        mode: "server",
      };
      setToken(session.token, session.expiresAt, {
        handle: session.handle,
        email: input.email,
        mode: "server",
      });
      return session;
    } catch (err) {
      // Fall through to local vault only when the account API is unreachable.
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 0;
      if (status && status < 500) throw asAuthError(err);
    }
  }

  try {
    const res = await localRegister(input);
    const session: AuthSession = {
      ok: true,
      token: res.token,
      expiresAt: res.expiresAt,
      handle: res.handle,
      recoveryKey: res.recoveryKey,
      mode: "local",
    };
    setToken(session.token, session.expiresAt, {
      handle: session.handle,
      email: res.email,
      mode: "local",
    });
    return session;
  } catch (err) {
    throw asAuthError(err);
  }
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  if (pageCanReachApi()) {
    try {
      const res = await api<{ ok: boolean; token: string; expiresAt: string; handle: string }>(
        "/api/v1/auth/login",
        {
          method: "POST",
          auth: false,
          body: JSON.stringify(input),
        },
      );
      const session: AuthSession = {
        ok: true,
        token: res.token,
        expiresAt: res.expiresAt,
        handle: res.handle,
        mode: "server",
      };
      setToken(session.token, session.expiresAt, {
        handle: session.handle,
        email: input.email,
        mode: "server",
      });
      return session;
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 0;
      if (status === 401 || status === 429 || (status >= 400 && status < 500)) throw asAuthError(err);
    }
  }

  try {
    const res = await localLogin(input);
    const session: AuthSession = {
      ok: true,
      token: res.token,
      expiresAt: res.expiresAt,
      handle: res.handle,
      mode: "local",
    };
    setToken(session.token, session.expiresAt, {
      handle: session.handle,
      email: res.email,
      mode: "local",
    });
    return session;
  } catch (err) {
    throw asAuthError(err);
  }
}

export async function resetPassword(input: {
  email: string;
  recoveryKey: string;
  newPassword: string;
}): Promise<AuthSession> {
  if (pageCanReachApi()) {
    try {
      const res = await api<{ ok: boolean; token: string; expiresAt: string; handle: string }>(
        "/api/v1/auth/password/reset",
        {
          method: "POST",
          auth: false,
          body: JSON.stringify(input),
        },
      );
      const session: AuthSession = {
        ok: true,
        token: res.token,
        expiresAt: res.expiresAt,
        handle: res.handle,
        mode: "server",
      };
      setToken(session.token, session.expiresAt, {
        handle: session.handle,
        email: input.email,
        mode: "server",
      });
      return session;
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 0;
      if (status && status < 500) throw asAuthError(err);
    }
  }

  try {
    const res = await localResetPassword(input);
    const session: AuthSession = {
      ok: true,
      token: res.token,
      expiresAt: res.expiresAt,
      handle: res.handle,
      mode: "local",
    };
    setToken(session.token, session.expiresAt, {
      handle: session.handle,
      email: res.email,
      mode: "local",
    });
    return session;
  } catch (err) {
    throw asAuthError(err);
  }
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const token = getToken();
  if (isLocalToken(token)) {
    await localChangePassword({
      token: token!,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    return;
  }
  await api<{ ok: boolean }>("/api/v1/auth/password/change", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function me() {
  const token = getToken();
  if (isLocalToken(token)) {
    const profile = await localMe(token!);
    return {
      handle: profile.handle,
      email: profile.email,
      githubLogin: null as string | null,
      mode: profile.mode,
      webauthnEnabled: false,
      totpVerified: false,
    };
  }
  return api<{
    handle: string;
    email: string | null;
    githubLogin: string | null;
    mode: string;
    webauthnEnabled: boolean;
    totpVerified: boolean;
  }>("/api/v1/auth/me");
}

export async function logout() {
  const token = getToken();
  if (isLocalToken(token)) {
    await localLogout(token);
    return { ok: true };
  }
  if (!pageCanReachApi()) return { ok: true };
  return api<{ ok: boolean }>("/api/v1/auth/logout", { method: "POST" });
}
