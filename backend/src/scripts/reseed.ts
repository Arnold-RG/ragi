/**
 * DESTRUCTIVE — wipes owner vault tables.
 * Requires RAGI_ALLOW_WIPE=YES in the environment. Code changes never call this.
 */
import { db } from "../shared/db.js";

if (process.env.RAGI_ALLOW_WIPE !== "YES") {
  console.error(
    "Refusing reseed. Vault storage is durable. Set RAGI_ALLOW_WIPE=YES only if you intend to erase everything.",
  );
  process.exit(1);
}

await db.session.deleteMany();
await db.auditLog.deleteMany();
await db.authChallenge.deleteMany();
await db.webAuthnCredential.deleteMany();
await db.oAuthToken.deleteMany();
await db.briefingCache.deleteMany();
await db.secureNote.deleteMany();
await db.jobEntry.deleteMany();
await db.focusBlock.deleteMany();
await db.project.deleteMany();
await db.goal.deleteMany();
await db.activity.deleteMany();
await db.financeEntry.deleteMany();
await db.meeting.deleteMany();
await db.reminder.deleteMany();
await db.emergency.deleteMany();
await db.modeState.deleteMany();
await db.owner.deleteMany();
await db.systemMeta.deleteMany();
console.log("cleared (RAGI_ALLOW_WIPE=YES)");
await db.$disconnect();
