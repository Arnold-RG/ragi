import { db } from "../lib/db.js";

await db.session.deleteMany();
await db.auditLog.deleteMany();
await db.authChallenge.deleteMany();
await db.webAuthnCredential.deleteMany();
await db.oAuthToken.deleteMany();
await db.briefingCache.deleteMany();
await db.secureNote.deleteMany();
await db.jobEntry.deleteMany();
await db.focusBlock.deleteMany();
await db.modeState.deleteMany();
await db.owner.deleteMany();
await db.systemMeta.deleteMany();
console.log("cleared");
await db.$disconnect();
