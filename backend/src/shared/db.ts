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
