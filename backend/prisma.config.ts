import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig } from "prisma/config";

const backendRoot = import.meta.dirname;
loadEnv({ path: resolve(backendRoot, ".env") });

/**
 * Prisma 6 resolved `file:` URLs relative to the schema directory.
 * Keep that location (`backend/prisma/...`) so existing vault files still open.
 * Generate and Docker builds have no `.env`; the local SQLite default covers them.
 */
function datasourceUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./data/ragi.db";
  if (!raw.startsWith("file:")) return raw;
  const rel = raw.replace(/^file:/, "").replace(/^\.\//, "");
  const abs = resolve(backendRoot, "prisma", rel);
  mkdirSync(dirname(abs), { recursive: true });
  return pathToFileURL(abs).href;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl(),
  },
});
