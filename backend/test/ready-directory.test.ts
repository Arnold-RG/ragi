import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const backendRoot = join(import.meta.dirname, "..");

test("/ready returns 503 when the database directory is read-only", async () => {
  const dir = join(tmpdir(), `ragi-ready-${process.pid}`);
  const dbFile = join(dir, "ragi.db");
  const databaseUrl = `file:${dbFile}`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.RAGI_MASTER_KEY = "ci-master-key-0123456789abcdef-extra";
  process.env.RAGI_SESSION_SECRET = "ci-session-secret-0123456789abcdef";
  process.env.NODE_ENV = "test";

  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await execFileAsync("npx", ["prisma", "db", "push"], {
    cwd: backendRoot,
    env: process.env,
  });

  const { buildApp } = await import("../src/app.ts");
  const { db } = await import("../src/shared/db.ts");
  const app = await buildApp();
  try {
    const ready = await app.inject({ method: "GET", url: "/ready" });
    assert.equal(ready.statusCode, 200);
    assert.equal(ready.json().ready, true);

    const before = await db.$queryRaw<Array<{ user_version: number | bigint }>>`PRAGMA user_version`;
    const version = Number(before[0]?.user_version ?? 0);

    await chmod(dir, 0o555);
    await chmod(dbFile, 0o644);

    const blocked = await app.inject({ method: "GET", url: "/ready" });
    assert.equal(blocked.statusCode, 503);
    assert.equal(blocked.json().ready, false);

    await chmod(dir, 0o755);
    const restored = await app.inject({ method: "GET", url: "/ready" });
    assert.equal(restored.statusCode, 200);
    const after = await db.$queryRaw<Array<{ user_version: number | bigint }>>`PRAGMA user_version`;
    assert.equal(Number(after[0]?.user_version ?? 0), version);
  } finally {
    await chmod(dir, 0o755).catch(() => undefined);
    await app.close();
    await db.$disconnect();
    await rm(dir, { recursive: true, force: true });
  }
});
