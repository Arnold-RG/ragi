import { logger } from "../logger.js";
import { createSnapshot } from "./snapshots.js";

let timer: ReturnType<typeof setTimeout> | null = null;
let ownerId: string | null = null;
let pendingReason = "write";

/**
 * Debounced durable snapshot after vault mutations.
 * Keeps storage memory constant across code edits / restarts.
 */
export function touchVault(oid: string, reason = "write") {
  ownerId = oid;
  pendingReason = reason;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void flushVault();
  }, 2500);
}

export async function flushVault() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!ownerId) return null;
  const oid = ownerId;
  const reason = pendingReason;
  try {
    return await createSnapshot(oid, reason);
  } catch (err) {
    logger.warn({ err }, "vault snapshot failed");
    return null;
  }
}
