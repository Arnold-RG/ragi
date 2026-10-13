import { logger } from "../logger.js";
import { createSnapshot } from "./snapshots.js";

let timer: ReturnType<typeof setTimeout> | null = null;
const pending = new Map<string, string>();

/**
 * Debounced durable snapshot after vault mutations.
 * Each account is flushed on its own. One member's write never seals another's book.
 */
export function touchVault(oid: string, reason = "write") {
  pending.set(oid, reason);
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
  const jobs = [...pending.entries()];
  pending.clear();
  let last = null;
  for (const [oid, reason] of jobs) {
    try {
      last = await createSnapshot(oid, reason);
    } catch (err) {
      logger.warn({ err }, "vault snapshot failed");
    }
  }
  return last;
}
