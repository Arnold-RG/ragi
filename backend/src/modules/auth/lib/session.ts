import { SignJWT, jwtVerify } from "jose";
import type { FastifyRequest } from "fastify";
import { env } from "../../../shared/config.js";
import { db } from "../../../shared/db.js";
import { randomToken, sha256Hex } from "../../../shared/crypto.js";

const secret = () => new TextEncoder().encode(env.RAGI_SESSION_SECRET);

export type GateId = "passphrase" | "totp_or_backup" | "device_or_passkey";

export async function createSession(input: {
  ownerId: string;
  gatesPassed: GateId[];
  ip?: string;
  userAgent?: string;
}) {
  const raw = randomToken(48);
  const tokenHash = sha256Hex(raw);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000);

  await db.session.create({
    data: {
      ownerId: input.ownerId,
      tokenHash,
      gatesPassed: JSON.stringify(input.gatesPassed),
      ip: input.ip,
      userAgent: input.userAgent,
      expiresAt,
    },
  });

  const jwt = await new SignJWT({
    sid: tokenHash,
    oid: input.ownerId,
    gates: input.gatesPassed,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_TTL_SECONDS}s`)
    .setIssuer("ragi")
    .setAudience("ragi-owner")
    .sign(secret());

  return { token: jwt, rawRef: raw, expiresAt };
}

export async function revokeSession(tokenHash: string) {
  await db.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function readSession(req: FastifyRequest) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookie = (req as FastifyRequest & { cookies?: Record<string, string> }).cookies?.[
    env.RAGI_COOKIE_NAME
  ];
  const token = bearer || cookie;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "ragi",
      audience: "ragi-owner",
    });
    const sid = String(payload.sid ?? "");
    const oid = String(payload.oid ?? "");
    if (!sid || !oid) return null;

    const row = await db.session.findUnique({ where: { tokenHash: sid } });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) return null;
    if (row.ownerId !== oid) return null;

    return {
      ownerId: oid,
      tokenHash: sid,
      gatesPassed: JSON.parse(row.gatesPassed) as GateId[],
      expiresAt: row.expiresAt,
    };
  } catch {
    return null;
  }
}

export function requireFullGates(gates: GateId[]): boolean {
  return (
    gates.includes("passphrase") &&
    gates.includes("totp_or_backup") &&
    gates.includes("device_or_passkey")
  );
}
