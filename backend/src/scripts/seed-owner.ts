import { authenticator } from "otplib";
import QRCode from "qrcode";
import { env } from "../shared/config.js";
import { db } from "../shared/db.js";
import { encryptString, hashSecret, newSalt } from "../shared/crypto.js";
import { logger } from "../shared/logger.js";

async function main() {
  const passphrase = env.OWNER_PASSPHRASE;
  const backup = env.OWNER_BACKUP_CODE;
  const deviceKey = env.OWNER_DEVICE_KEY;

  if (!passphrase || !backup || !deviceKey) {
    throw new Error("Set OWNER_PASSPHRASE, OWNER_BACKUP_CODE, OWNER_DEVICE_KEY in backend/.env");
  }

  const existing = await db.owner.findUnique({ where: { handle: "owner" } });
  if (existing) {
    logger.warn("Owner already seeded — refusing to overwrite immutable locks");
    process.exit(0);
  }

  const vaultSalt = newSalt(24);
  const totpSecret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri("owner", env.OWNER_TOTP_ISSUER, totpSecret);

  const owner = await db.owner.create({
    data: {
      handle: "owner",
      passphraseHash: await hashSecret(passphrase),
      backupCodeHash: await hashSecret(backup),
      deviceKeyHash: await hashSecret(deviceKey),
      totpSecretEnc: encryptString(totpSecret, vaultSalt),
      totpVerified: true,
      vaultSalt,
      modeState: { create: { mode: "work" } },
    },
  });

  await db.systemMeta.createMany({
    data: [
      { key: "seeded_at", value: new Date().toISOString() },
      { key: "locks_immutable", value: "true" },
      { key: "product", value: "RAGI" },
    ],
  });

  const qr = await QRCode.toDataURL(otpauth);
  logger.info(
    {
      ownerId: owner.id,
      totpOtpauth: otpauth,
      totpQrDataUrlChars: qr.length,
      note: "Backup code still works as gate 2. Add authenticator via otpauth URL.",
    },
    "Owner seeded",
  );
  console.log("\nRAGI owner seeded.");
  console.log("TOTP otpauth URL (add to authenticator app):\n", otpauth);
  console.log("\nGate 2 also accepts OWNER_BACKUP_CODE from .env");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
