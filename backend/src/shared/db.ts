import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { sqliteDbPath } from "./storage/paths.js";

const sqlitePath = sqliteDbPath();
if (!sqlitePath) {
  throw new Error(
    "RAGI Prisma schema uses SQLite. Set DATABASE_URL to a file: URL (see backend/.env.example).",
  );
}

const adapter = new PrismaBetterSqlite3({ url: sqlitePath });

export const db = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

export async function dbReady(): Promise<boolean> {
  await db.$queryRaw`SELECT 1`;
  return true;
}

const readyProbeRollback = new Error("ready-probe-rollback");

/**
 * Write the current SQLite user_version inside a transaction and roll it back.
 * Assigning user_version updates the database header, so a read-only directory
 * fails with SQLITE_READONLY_DIRECTORY instead of a no-op update.
 */
export async function dbWritable(): Promise<void> {
  const currentRows = await db.$queryRaw<Array<{ user_version: number | bigint }>>`
    PRAGMA user_version
  `;
  const current = Number(currentRows[0]?.user_version ?? 0);
  if (!Number.isInteger(current)) {
    throw new Error("SQLite user_version was not an integer.");
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`PRAGMA user_version = ${current}`);
      throw readyProbeRollback;
    });
  } catch (err) {
    if (err === readyProbeRollback) return;
    throw err;
  }
  throw new Error("Ready probe write was committed.");
}
