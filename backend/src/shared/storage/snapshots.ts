import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import { backupsRoot, storageReady } from "./paths.js";
import { exportVault } from "./export-vault.js";

export type SnapshotMeta = {
  id: string;
  createdAt: string;
  ownerId: string;
  jsonPath: string;
  dbPath: string | null;
  bytes: number;
  counts?: Record<string, number>;
};

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** Write one account's vault as append-only JSON. Never a full database image. */
export async function createSnapshot(ownerId: string, reason = "manual"): Promise<SnapshotMeta> {
  const id = `snap-${stamp()}`;
  const dir = backupsRoot();
  const jsonPath = join(dir, `${id}.json`);
  const payload = await exportVault(ownerId);
  const body = JSON.stringify({ ...payload, snapshotId: id, reason }, null, 2);
  writeFileSync(jsonPath, body, "utf8");

  // JSON only. A full database copy would mix every member's rows into one file.
  const meta: SnapshotMeta = {
    id,
    createdAt: new Date().toISOString(),
    ownerId,
    jsonPath,
    dbPath: null,
    bytes: Buffer.byteLength(body),
    counts: payload.counts,
  };

  writeFileSync(join(dir, `${id}.meta.json`), JSON.stringify(meta, null, 2), "utf8");
  logger.info({ id, reason, bytes: meta.bytes }, "vault snapshot sealed");
  return meta;
}

export function listSnapshots(ownerId?: string): SnapshotMeta[] {
  const dir = backupsRoot();
  const files = readdirSync(dir).filter((f) => f.endsWith(".meta.json"));
  const out: SnapshotMeta[] = [];
  for (const f of files) {
    try {
      const snap = JSON.parse(readFileSync(join(dir, f), "utf8")) as SnapshotMeta;
      if (ownerId && snap.ownerId !== ownerId) continue;
      if (ownerId && !snap.ownerId) continue;
      out.push(snap);
    } catch {
      /* skip corrupt */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadSnapshotJson(id: string, ownerId?: string): unknown {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const path = join(backupsRoot(), `${safe}.json`);
  if (!existsSync(path)) throw new Error("snapshot_not_found");
  const data = JSON.parse(readFileSync(path, "utf8")) as { ownerId?: string };
  if (ownerId && data.ownerId !== ownerId) throw new Error("snapshot_not_found");
  return data;
}

export function storageStatus(ownerId?: string) {
  const ready = storageReady();
  const snaps = listSnapshots(ownerId);
  return {
    ...ready,
    snapshotCount: snaps.length,
    latestSnapshot: snaps[0] ?? null,
    durable: true,
    note: "Vault rows live in the DB volume. Snapshots are append-only memory on disk. Code changes never wipe them.",
  };
}
