import { env } from "./config.js";
import { buildApp } from "./app.js";
import { initCache, closeCache } from "./lib/redis.js";
import { db } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { runtimeReport } from "./lib/memory.js";

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

  await initCache();
  const app = await buildApp();

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
    },
    "RAGI backend online",
  );
}

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
