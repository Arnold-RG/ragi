import { db } from "./db.js";
import { decryptString, encryptString } from "./crypto.js";

/** Owner vault helper — encrypt/decrypt with that owner's salt. */
export async function withOwnerVault(ownerId: string) {
  const owner = await db.owner.findUniqueOrThrow({ where: { id: ownerId } });
  const salt = owner.vaultSalt;
  return {
    owner,
    salt,
    enc: (plain: string) => encryptString(plain, salt),
    dec: (payload: string) => decryptString(payload, salt),
  };
}
