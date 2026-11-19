import { randomBytes } from "node:crypto";
console.log("RAGI_MASTER_KEY=" + randomBytes(48).toString("base64url"));
console.log("RAGI_SESSION_SECRET=" + randomBytes(48).toString("base64url"));
