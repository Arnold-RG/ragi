import { env } from "./shared/config.js";
import { buildApp } from "./app.js";
import { initCache, closeCache } from "./shared/redis.js";
import { db } from "./shared/db.js";
import { logger } from "./shared/logger.js";
import { runtimeReport } from "./shared/memory.js";
import { storageStatus } from "./shared/storage/snapshots.js";
import { backupsRoot, dataRoot } from "./shared/storage/paths.js";

async function main() {
  if (!process.env.NODE_OPTIONS?.includes("max-old-space-size") && env.RAGI_HEAP_MB >= 1024) {
    logger.warn(
      {
        tip: `Start with: node --max-old-space-size=${env.RAGI_HEAP_MB} dist/server.js`,
        configuredHeapMb: env.RAGI_HEAP_MB,
      },
      "RAGI heap not applied via NODE_OPTIONS yet (dev/tsx is fine)",
    );
  }

  dataRoot();
  backupsRoot();
  await initCache();
  const app = await buildApp();
  logger.info(storageStatus(), "durable vault storage ready");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    await app.close();
    await closeCache();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ host: env.RAGI_HOST, port: env.RAGI_PORT });
  logger.info(
    {
      url: `http://${env.RAGI_HOST}:${env.RAGI_PORT}`,
      runtime: runtimeReport(),
      layers: ["bootstrap", "shared", "modules"],
    },
    "RAGI backend online",
  );
}

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
