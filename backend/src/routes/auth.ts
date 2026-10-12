import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticator } from "otplib";
import { db } from "../lib/db.js";
import { decryptString, verifySecret } from "../lib/crypto.js";
import { audit } from "../security/audit.js";
import {
  beginLoginChallenge,
  clearFails,
  consumeLoginChallenge,
  loadLoginChallenge,
  registerFail,
  saveLoginChallenge,
} from "../auth/challenges.js";
import { createSession, readSession, revokeSession, type GateId } from "../auth/session.js";
import { env } from "../config.js";
import {
  authenticationOptions,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration,
} from "../auth/webauthn.js";
import { cacheGet, cacheSet } from "../lib/redis.js";
// cacheGet used for lockout + webauthn challenges

function clientMeta(req: { ip: string; headers: Record<string, unknown> }) {
  return {
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] ?? ""),
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/v1/auth/challenge", async (req, reply) => {
    const meta = clientMeta(req);
    const lockedCount = Number((await cacheGet(`authfail:${meta.ip}`)) ?? "0");
    if (lockedCount > env.AUTH_MAX_ATTEMPTS) {
      await audit({ action: "auth.challenge", outcome: "deny", detail: { reason: "lockout" }, ...meta });
      return reply.code(429).send({ error: "locked_out", retryAfterSeconds: env.AUTH_LOCKOUT_SECONDS });
    }
    const challenge = await beginLoginChallenge();
    await audit({ action: "auth.challenge", outcome: "ok", ...meta });
    return challenge;
  });

  app.post("/api/v1/auth/gate/1", async (req, reply) => {
    const body = z
      .object({ challengeId: z.string().min(8), passphrase: z.string().min(8) })
      .parse(req.body);
    const meta = clientMeta(req);
    const fail = await registerFail(meta.ip);
    if (fail.locked) return reply.code(429).send({ error: "locked_out" });

    const challenge = await loadLoginChallenge(body.challengeId);
    if (!challenge) return reply.code(400).send({ error: "invalid_challenge" });

    const owner = await db.owner.findUnique({ where: { handle: "owner" } });
    if (!owner) return reply.code(503).send({ error: "owner_not_seeded" });

    const ok = await verifySecret(owner.passphraseHash, body.passphrase);
    if (!ok) {
      await audit({ ownerId: owner.id, action: "auth.gate1", outcome: "deny", vaultSalt: owner.vaultSalt, ...meta });
      return reply.code(401).send({ error: "gate1_denied" });
    }

    if (!challenge.gates.includes("passphrase")) challenge.gates.push("passphrase");
    await saveLoginChallenge(challenge);
    await audit({ ownerId: owner.id, action: "auth.gate1", outcome: "ok", vaultSalt: owner.vaultSalt, ...meta });
    return { ok: true, next: "gate2", gates: challenge.gates };
  });

  app.post("/api/v1/auth/gate/2", async (req, reply) => {
    const body = z
      .object({
        challengeId: z.string().min(8),
        code: z.string().min(6).max(12),
      })
      .parse(req.body);
    const meta = clientMeta(req);
    const challenge = await loadLoginChallenge(body.challengeId);
    if (!challenge?.gates.includes("passphrase")) {
      return reply.code(400).send({ error: "gate_order" });
    }

    const owner = await db.owner.findUnique({ where: { handle: "owner" } });
    if (!owner) return reply.code(503).send({ error: "owner_not_seeded" });

    let ok = await verifySecret(owner.backupCodeHash, body.code);
    if (!ok && owner.totpSecretEnc && owner.totpVerified) {
      const secret = decryptString(owner.totpSecretEnc, owner.vaultSalt);
      ok = authenticator.check(body.code, secret);
    }

    if (!ok) {
      await registerFail(meta.ip);
      await audit({ ownerId: owner.id, action: "auth.gate2", outcome: "deny", vaultSalt: owner.vaultSalt, ...meta });
      return reply.code(401).send({ error: "gate2_denied" });
    }

    if (!challenge.gates.includes("totp_or_backup")) challenge.gates.push("totp_or_backup");
    await saveLoginChallenge(challenge);
    await audit({ ownerId: owner.id, action: "auth.gate2", outcome: "ok", vaultSalt: owner.vaultSalt, ...meta });
    return { ok: true, next: "gate3", gates: challenge.gates };
  });

  app.post("/api/v1/auth/gate/3", async (req, reply) => {
    const body = z
      .object({
        challengeId: z.string().min(8),
        deviceKey: z.string().min(8).optional(),
        webauthnResponse: z.unknown().optional(),
      })
      .parse(req.body);
    const meta = clientMeta(req);
    const challenge = await loadLoginChallenge(body.challengeId);
    if (!challenge?.gates.includes("passphrase") || !challenge.gates.includes("totp_or_backup")) {
      return reply.code(400).send({ error: "gate_order" });
    }

    const owner = await db.owner.findUnique({ where: { handle: "owner" } });
    if (!owner) return reply.code(503).send({ error: "owner_not_seeded" });

    let ok = false;
    if (body.deviceKey) {
      ok = await verifySecret(owner.deviceKeyHash, body.deviceKey);
    } else if (body.webauthnResponse) {
      const expected = await cacheGet(`webauthn:auth:${body.challengeId}`);
      if (!expected) return reply.code(400).send({ error: "missing_webauthn_challenge" });
      try {
        const ownerId = await verifyAuthentication(body.webauthnResponse, expected);
        ok = ownerId === owner.id;
      } catch {
        ok = false;
      }
    }

    if (!ok) {
      await registerFail(meta.ip);
      await audit({ ownerId: owner.id, action: "auth.gate3", outcome: "deny", vaultSalt: owner.vaultSalt, ...meta });
      return reply.code(401).send({ error: "gate3_denied" });
    }

    const gates: GateId[] = ["passphrase", "totp_or_backup", "device_or_passkey"];
    await consumeLoginChallenge(body.challengeId);
    await clearFails(meta.ip);

    const session = await createSession({
      ownerId: owner.id,
      gatesPassed: gates,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    reply.setCookie(env.RAGI_COOKIE_NAME, session.token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      maxAge: env.SESSION_TTL_SECONDS,
    });

    await audit({ ownerId: owner.id, action: "auth.session", outcome: "ok", vaultSalt: owner.vaultSalt, ...meta });
    return {
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      gates,
    };
  });

  app.post("/api/v1/auth/webauthn/auth-options", async (req, reply) => {
    const body = z.object({ challengeId: z.string().min(8) }).parse(req.body);
    const challenge = await loadLoginChallenge(body.challengeId);
    if (!challenge?.gates.includes("totp_or_backup")) {
      return reply.code(400).send({ error: "gate_order" });
    }
    const options = await authenticationOptions();
    await cacheSet(`webauthn:auth:${body.challengeId}`, options.challenge, 300);
    return options;
  });

  app.post("/api/v1/auth/webauthn/register-options", { preHandler: app.requireOwner }, async (req) => {
    const options = await registrationOptions(req.ragiOwnerId!);
    await cacheSet(`webauthn:reg:${req.ragiOwnerId}`, options.challenge, 300);
    return options;
  });

  app.post("/api/v1/auth/webauthn/register", { preHandler: app.requireOwner }, async (req, reply) => {
    const expected = await cacheGet(`webauthn:reg:${req.ragiOwnerId}`);
    if (!expected) return reply.code(400).send({ error: "missing_challenge" });
    await verifyRegistration(req.ragiOwnerId!, req.body, expected);
    return { ok: true };
  });

  app.get("/api/v1/auth/me", { preHandler: app.requireOwner }, async (req) => {
    const owner = await db.owner.findUniqueOrThrow({ where: { id: req.ragiOwnerId! } });
    const mode = await db.modeState.findUnique({ where: { ownerId: owner.id } });
    return {
      handle: owner.handle,
      webauthnEnabled: owner.webauthnEnabled,
      totpVerified: owner.totpVerified,
      mode: mode?.mode ?? "work",
    };
  });

  app.post("/api/v1/auth/logout", { preHandler: app.requireOwner }, async (req, reply) => {
    if (req.ragiSessionHash) await revokeSession(req.ragiSessionHash);
    reply.clearCookie(env.RAGI_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/api/v1/auth/session", async (req) => {
    const session = await readSession(req);
    return { authenticated: Boolean(session && session.gatesPassed.length === 3) };
  });
};
