import type { FastifyPluginAsync } from "fastify";
import { dbReady } from "../../shared/db.js";
import { cacheStats } from "../../shared/redis.js";
import { runtimeReport } from "../../shared/memory.js";
import { env } from "../../shared/config.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    let db = false;
    try {
      db = await dbReady();
    } catch {
      db = false;
    }
    return {
      ok: db,
      service: "ragi-backend",
      version: "1.0.0",
      time: new Date().toISOString(),
      cache: cacheStats(),
      runtime: runtimeReport(),
      features: {
        gemini: Boolean(env.GEMINI_API_KEY),
        googleCalendar: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        microsoftCalendar: Boolean(env.MS_CLIENT_ID && env.MS_CLIENT_SECRET),
        redis: Boolean(env.REDIS_URL),
      },
    };
  });

  app.get("/ready", async (_req, reply) => {
    try {
      await dbReady();
      return { ready: true };
    } catch {
      return reply.code(503).send({ ready: false });
    }
  });
};
