import { api } from "./client";

export type Challenge = { challengeId: string; expiresInSeconds: number };

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

export function me() {
  return api<{ handle: string; mode: string; webauthnEnabled: boolean; totpVerified: boolean }>(
    "/api/v1/auth/me",
  );
}

export function logout() {
  return api<{ ok: boolean }>("/api/v1/auth/logout", { method: "POST" });
}
