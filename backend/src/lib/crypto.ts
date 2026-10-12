import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { env } from "../config.js";

const ARGON = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 2,
} as const;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function hashSecret(value: string): Promise<string> {
  return argon2.hash(value, ARGON);
}

export async function verifySecret(hash: string, value: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, value);
  } catch {
    return false;
  }
}

function masterKeyBytes(): Buffer {
  const raw = env.RAGI_MASTER_KEY;
  const buf = Buffer.from(raw, "utf8");
  return createHash("sha256").update(buf).digest();
}

export function newSalt(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

export function deriveVaultKey(saltB64: string): Buffer {
  return scryptSync(masterKeyBytes(), Buffer.from(saltB64, "base64url"), 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

export function encryptString(plain: string, saltB64: string): string {
  const key = deriveVaultKey(saltB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptString(payload: string, saltB64: string): string {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = deriveVaultKey(saltB64);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
