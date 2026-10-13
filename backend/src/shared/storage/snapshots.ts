import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../db.js";
import { logger } from "../logger.js";
import { backupsRoot, sqliteDbPath, storageReady } from "./paths.js";
import { exportVault } from "./export-vault.js";

export type SnapshotMeta = {
  id: string;
  createdAt: string;
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

async function checkpointSqlite() {
  if (!sqliteDbPath()) return;
  try {
    await db.$executeRawUnsafe("PRAGMA wal_checkpoint(FULL)");
  } catch {
    /* ignore — postgres or locked */
  }
}

/** Write durable snapshot: JSON vault memory + SQLite file copy when local. */
export async function createSnapshot(ownerId: string, reason = "manual"): Promise<SnapshotMeta> {
  const id = `snap-${stamp()}`;
  const dir = backupsRoot();
  const jsonPath = join(dir, `${id}.json`);
  const payload = await exportVault(ownerId);
  const body = JSON.stringify({ ...payload, snapshotId: id, reason }, null, 2);
  writeFileSync(jsonPath, body, "utf8");

  let dbCopy: string | null = null;
  const src = sqliteDbPath();
  if (src && existsSync(src)) {
    await checkpointSqlite();
    dbCopy = join(dir, `${id}.db`);
    copyFileSync(src, dbCopy);
  }

  const meta: SnapshotMeta = {
    id,
    createdAt: new Date().toISOString(),
    jsonPath,
    dbPath: dbCopy,
    bytes: Buffer.byteLength(body) + (dbCopy && existsSync(dbCopy) ? statSync(dbCopy).size : 0),
    counts: payload.counts,
  };

  writeFileSync(join(dir, `${id}.meta.json`), JSON.stringify(meta, null, 2), "utf8");
  logger.info({ id, reason, bytes: meta.bytes }, "vault snapshot sealed");
  return meta;
}

export function listSnapshots(): SnapshotMeta[] {
  const dir = backupsRoot();
  const files = readdirSync(dir).filter((f) => f.endsWith(".meta.json"));
  const out: SnapshotMeta[] = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(readFileSync(join(dir, f), "utf8")) as SnapshotMeta);
    } catch {
      /* skip corrupt */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadSnapshotJson(id: string): unknown {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const path = join(backupsRoot(), `${safe}.json`);
  if (!existsSync(path)) throw new Error("snapshot_not_found");
  return JSON.parse(readFileSync(path, "utf8"));
}

export function storageStatus() {
  const ready = storageReady();
  const snaps = listSnapshots();
  return {
    ...ready,
    snapshotCount: snaps.length,
    latestSnapshot: snaps[0] ?? null,
    durable: true,
    note: "Vault rows live in the DB volume. Snapshots are append-only memory on disk. Code changes never wipe them.",
  };
}
