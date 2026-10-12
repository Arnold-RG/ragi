import { db } from "../lib/db.js";
import { encryptString, decryptString, newSalt, randomToken } from "../lib/crypto.js";
import { env } from "../config.js";
import { cacheGet, cacheSet, cacheDel, cacheIncr } from "../lib/redis.js";

const challengeSalt = () => createChallengeSalt();

function createChallengeSalt() {
  // Stable per-process salt derived from master key material for challenge envelopes.
  return Buffer.from(env.RAGI_MASTER_KEY).toString("base64url").slice(0, 22);
}

export async function beginLoginChallenge() {
  const id = randomToken(24);
  const payload = {
    id,
    gates: [] as string[],
    createdAt: Date.now(),
  };
  const enc = encryptString(JSON.stringify(payload), challengeSalt());
  await db.authChallenge.create({
    data: {
      id,
      kind: "login",
      payloadEnc: enc,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  await cacheSet(`login:${id}`, JSON.stringify(payload), 600);
  return { challengeId: id, expiresInSeconds: 600 };
}

export async function loadLoginChallenge(id: string) {
  const cached = await cacheGet(`login:${id}`);
  if (cached) return JSON.parse(cached) as { id: string; gates: string[]; createdAt: number };

  const row = await db.authChallenge.findUnique({ where: { id } });
  if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) return null;
  const plain = decryptString(row.payloadEnc, challengeSalt());
  return JSON.parse(plain) as { id: string; gates: string[]; createdAt: number };
}

export async function saveLoginChallenge(payload: { id: string; gates: string[]; createdAt: number }) {
  const enc = encryptString(JSON.stringify(payload), challengeSalt());
  await db.authChallenge.update({
    where: { id: payload.id },
    data: { payloadEnc: enc },
  });
  await cacheSet(`login:${payload.id}`, JSON.stringify(payload), 600);
}

export async function consumeLoginChallenge(id: string) {
  await db.authChallenge.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
  await cacheDel(`login:${id}`);
}

export async function registerFail(ip: string): Promise<{ locked: boolean; count: number }> {
  const key = `authfail:${ip}`;
  const count = await cacheIncr(key, env.AUTH_LOCKOUT_SECONDS);
  return { locked: count > env.AUTH_MAX_ATTEMPTS, count };
}

export async function clearFails(ip: string) {
  await cacheDel(`authfail:${ip}`);
}

export { newSalt };
