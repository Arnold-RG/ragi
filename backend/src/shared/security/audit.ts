import { db } from "../db.js";
import { encryptString } from "../crypto.js";

export async function audit(input: {
  ownerId?: string | null;
  action: string;
  outcome: "ok" | "deny" | "error" | "info";
  detail?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  vaultSalt?: string | null;
}) {
  let detailEnc: string | null = null;
  if (input.detail && input.vaultSalt) {
    detailEnc = encryptString(JSON.stringify(input.detail), input.vaultSalt);
  } else if (input.detail) {
    detailEnc = Buffer.from(JSON.stringify(input.detail), "utf8").toString("base64url");
  }

  await db.auditLog.create({
    data: {
      ownerId: input.ownerId ?? null,
      action: input.action,
      outcome: input.outcome,
      detailEnc,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
