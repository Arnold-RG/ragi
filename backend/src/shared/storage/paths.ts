import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config.js";

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, "../../..");

/** Durable on-disk vault root — survives code edits; never commit contents. */
export function dataRoot() {
  if (env.RAGI_DATA_DIR?.trim()) {
    const abs = resolve(env.RAGI_DATA_DIR.trim());
    mkdirSync(abs, { recursive: true });
    return abs;
  }
  const abs = resolve(backendRoot, "prisma", "data");
  mkdirSync(abs, { recursive: true });
  return abs;
}

export function backupsRoot() {
  const abs = resolve(dataRoot(), "backups");
  mkdirSync(abs, { recursive: true });
  return abs;
}

export function sqliteDbPath(): string | null {
  const url = env.DATABASE_URL;
  if (!url.startsWith("file:")) return null;
  const rel = url.replace(/^file:/, "").replace(/^\.\//, "");
  return resolve(backendRoot, "prisma", rel);
}

export function storageReady() {
  const root = dataRoot();
  const backups = backupsRoot();
  return {
    dataRoot: root,
    backupsRoot: backups,
    sqlitePath: sqliteDbPath(),
    sqliteExists: (() => {
      const p = sqliteDbPath();
      return p ? existsSync(p) : false;
    })(),
    engine: env.DATABASE_URL.startsWith("file:") ? "sqlite" : "postgres",
  };
}
