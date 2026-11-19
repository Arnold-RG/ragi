import type { FastifyPluginAsync } from "fastify";
import { db } from "../../shared/db.js";
import { cacheStats } from "../../shared/redis.js";
import { runtimeReport } from "../../shared/memory.js";

/** Architecture / ops surface for the owner session. */
export const systemRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/system/architecture", async () => ({
    product: "RAGI",
    layout: {
      bootstrap: ["plugins", "routes", "server"],
      shared: ["config", "db", "crypto", "vault", "redis", "logger", "errors", "security"],
      modules: ["health", "system", "auth", "secretary", "calendar", "ai"],
    },
    database: {
      engine: "prisma",
      local: "sqlite (prisma/data/ragi.db)",
      production: "postgresql via docker-compose",
    },
    security: [
      "email and password accounts",
      "argon2id password hashes",
      "per-account aes-256-gcm vault",
      "jwt plus server-side sessions",
      "rate limit and lockout",
      "audit log",
      "request ids",
    ],
  }));

  app.get("/api/v1/system/status", { preHandler: app.requireOwner }, async (req) => {
    const [jobs, notes, focus, audits] = await Promise.all([
      db.jobEntry.count({ where: { ownerId: req.ragiOwnerId! } }),
      db.secureNote.count({ where: { ownerId: req.ragiOwnerId! } }),
      db.focusBlock.count({ where: { ownerId: req.ragiOwnerId!, completed: false } }),
      db.auditLog.count({ where: { ownerId: req.ragiOwnerId! } }),
    ]);
    return {
      ownerId: req.ragiOwnerId,
      counts: { jobs, notes, openFocus: focus, audits },
      cache: cacheStats(),
      runtime: runtimeReport(),
    };
  });
};
