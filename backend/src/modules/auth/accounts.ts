import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../../shared/db.js";
import { hashSecret, newSalt, sha256Hex, verifySecret } from "../../shared/crypto.js";
import { env } from "../../shared/config.js";
import { cacheGet } from "../../shared/redis.js";
import { audit } from "../../shared/security/audit.js";
import { createSnapshot } from "../../shared/storage/snapshots.js";
import { clearFails, registerFail } from "./lib/challenges.js";
import { createSession } from "./lib/session.js";

function mintRecoveryKey() {
  const raw = randomBytes(18).toString("base64url").toUpperCase();
  return `RAGI-${raw.slice(0, 8)}-${raw.slice(8, 16)}-${raw.slice(16, 24)}`;
}

const RESERVED = new Set(["admin", "owner", "root", "ragi", "support", "api", "system"]);

const WEAK = new Set([
  "password1234",
  "password12345",
  "password123456",
  "qwertyuiop12",
  "letmeinplease",
  "changeme1234",
  "iloveyou1234",
  "welcome12345",
  "admin1234567",
  "ragi12345678",
]);

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .max(254)
    .transform((s) => s.toLowerCase()),
  handle: z
    .string()
    .trim()
    .min(2, "Name should be at least 2 characters.")
    .max(24, "Name should be at most 24 characters.")
    .transform((s) => s.toLowerCase())
    .refine((s) => /^[a-z][a-z0-9-]{1,23}$/.test(s), {
      message: "Use letters, numbers, and hyphens, and start with a letter.",
    }),
  password: z.string().min(12, "Use at least 12 characters.").max(128, "That password is too long."),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1, "Enter your password.").max(128),
});

let dummyHashPromise: Promise<string> | null = null;
function dummyHash() {
  dummyHashPromise ??= hashSecret("ragi-timing-pad-not-a-password");
  return dummyHashPromise;
}

export async function isLocked(bucket: string) {
  const n = Number((await cacheGet(`authfail:${bucket}`)) ?? "0");
  return n > env.AUTH_MAX_ATTEMPTS;
}

function passwordProblem(password: string, email: string, handle: string) {
  const lower = password.toLowerCase();
  if (WEAK.has(lower)) return "Choose a less common password.";
  if (lower === email || lower === handle) return "Don't use your email or name as the password.";
  if (/^(.)\1{7,}$/.test(password)) return "Choose a less common password.";
  return null;
}

export async function registerAccount(input: {
  email: string;
  handle: string;
  password: string;
  ip: string;
  userAgent: string;
}) {
  if (RESERVED.has(input.handle)) {
    return { ok: false as const, status: 409, error: "handle_taken", message: "That name is already in use." };
  }
  const weak = passwordProblem(input.password, input.email, input.handle);
  if (weak) {
    return { ok: false as const, status: 400, error: "weak_password", message: weak };
  }

  const emailOwner = await db.owner.findUnique({ where: { email: input.email } });
  if (emailOwner) {
    return {
      ok: false as const,
      status: 409,
      error: "email_taken",
      message: "An account with that email already exists.",
    };
  }
  const handleOwner = await db.owner.findUnique({ where: { handle: input.handle } });
  if (handleOwner) {
    return { ok: false as const, status: 409, error: "handle_taken", message: "That name is already in use." };
  }

  const vaultSalt = newSalt(24);
  const passwordHash = await hashSecret(input.password);
  const recoveryKey = mintRecoveryKey();
  const recoveryHash = await hashSecret(recoveryKey);

  let owner;
  try {
    owner = await db.owner.create({
      data: {
        email: input.email,
        handle: input.handle,
        passwordHash,
        recoveryHash,
        vaultSalt,
        modeState: { create: { mode: "work" } },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = String(err.meta?.target ?? "");
      if (target.includes("email")) {
        return {
          ok: false as const,
          status: 409,
          error: "email_taken",
          message: "An account with that email already exists.",
        };
      }
      return { ok: false as const, status: 409, error: "handle_taken", message: "That name is already in use." };
    }
    throw err;
  }

  try {
    await createSnapshot(owner.id, "register");
  } catch {
    /* snapshot is best-effort; account row already durable */
  }

  const session = await createSession({
    ownerId: owner.id,
    gatesPassed: ["password"],
    ip: input.ip,
    userAgent: input.userAgent,
  });

  await audit({
    ownerId: owner.id,
    action: "auth.register",
    outcome: "ok",
    vaultSalt,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return {
    ok: true as const,
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    handle: owner.handle,
    email: owner.email,
    recoveryKey,
  };
}

export async function loginAccount(input: {
  email: string;
  password: string;
  ip: string;
  userAgent: string;
}) {
  const ipBucket = `ip:${input.ip}`;
  const mailBucket = `mail:${sha256Hex(input.email)}`;
  if ((await isLocked(ipBucket)) || (await isLocked(mailBucket))) {
    await audit({
      action: "auth.login",
      outcome: "deny",
      detail: { reason: "lockout" },
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return {
      ok: false as const,
      status: 429,
      error: "locked_out",
      message: "Too many attempts. Wait a while and try again.",
    };
  }

  const owner = await db.owner.findUnique({ where: { email: input.email } });
  const hash = owner?.passwordHash ?? (await dummyHash());
  const match = await verifySecret(hash, input.password);
  if (!owner?.passwordHash || !match) {
    await registerFail(ipBucket);
    await registerFail(mailBucket);
    await audit({
      ownerId: owner?.id,
      action: "auth.login",
      outcome: "deny",
      vaultSalt: owner?.vaultSalt,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return {
      ok: false as const,
      status: 401,
      error: "invalid_credentials",
      message: "Email or password is not right.",
    };
  }

  await clearFails(ipBucket);
  await clearFails(mailBucket);
  const session = await createSession({
    ownerId: owner.id,
    gatesPassed: ["password"],
    ip: input.ip,
    userAgent: input.userAgent,
  });
  await audit({
    ownerId: owner.id,
    action: "auth.login",
    outcome: "ok",
    vaultSalt: owner.vaultSalt,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return {
    ok: true as const,
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    handle: owner.handle,
    email: owner.email,
  };
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12, "Use at least 12 characters.").max(128),
});

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .max(254)
    .transform((s) => s.toLowerCase()),
  recoveryKey: z.string().trim().min(12).max(80),
  newPassword: z.string().min(12, "Use at least 12 characters.").max(128),
});

export async function changePassword(input: {
  ownerId: string;
  currentPassword: string;
  newPassword: string;
  ip: string;
  userAgent: string;
}) {
  const owner = await db.owner.findUnique({ where: { id: input.ownerId } });
  if (!owner?.passwordHash) {
    return { ok: false as const, status: 400, error: "no_password", message: "This account has no password." };
  }
  const match = await verifySecret(owner.passwordHash, input.currentPassword);
  if (!match) {
    return {
      ok: false as const,
      status: 401,
      error: "invalid_credentials",
      message: "Current password is not right.",
    };
  }
  const weak = passwordProblem(input.newPassword, owner.email ?? "", owner.handle);
  if (weak) {
    return { ok: false as const, status: 400, error: "weak_password", message: weak };
  }
  const passwordHash = await hashSecret(input.newPassword);
  await db.owner.update({ where: { id: owner.id }, data: { passwordHash } });
  try {
    await createSnapshot(owner.id, "password-change");
  } catch {
    /* best-effort */
  }
  await audit({
    ownerId: owner.id,
    action: "auth.password_change",
    outcome: "ok",
    vaultSalt: owner.vaultSalt,
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return { ok: true as const };
}

export async function resetPassword(input: {
  email: string;
  recoveryKey: string;
  newPassword: string;
  ip: string;
  userAgent: string;
}) {
  const owner = await db.owner.findUnique({ where: { email: input.email } });
  if (!owner?.recoveryHash || !owner.passwordHash) {
    return {
      ok: false as const,
      status: 401,
      error: "reset_denied",
      message: "No account matches that email and recovery key.",
    };
  }
  const ok = await verifySecret(owner.recoveryHash, input.recoveryKey.trim().toUpperCase());
  if (!ok) {
    await registerFail(`ip:${input.ip}`);
    return {
      ok: false as const,
      status: 401,
      error: "reset_denied",
      message: "No account matches that email and recovery key.",
    };
  }
  const weak = passwordProblem(input.newPassword, owner.email ?? "", owner.handle);
  if (weak) {
    return { ok: false as const, status: 400, error: "weak_password", message: weak };
  }
  const passwordHash = await hashSecret(input.newPassword);
  await db.owner.update({ where: { id: owner.id }, data: { passwordHash } });
  try {
    await createSnapshot(owner.id, "password-reset");
  } catch {
    /* best-effort */
  }
  const session = await createSession({
    ownerId: owner.id,
    gatesPassed: ["password"],
    ip: input.ip,
    userAgent: input.userAgent,
  });
  await audit({
    ownerId: owner.id,
    action: "auth.password_reset",
    outcome: "ok",
    vaultSalt: owner.vaultSalt,
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return {
    ok: true as const,
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    handle: owner.handle,
    email: owner.email,
  };
}
