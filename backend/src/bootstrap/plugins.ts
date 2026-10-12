import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import { randomUUID } from "node:crypto";
import { env, isProd } from "../shared/config.js";
import { registerAuthGuard } from "../modules/auth/guard.js";
import { AppError } from "../shared/errors.js";

export async function registerPlugins(app: FastifyInstance) {
  await app.register(sensible);
  await app.register(cookie, { secret: env.RAGI_SESSION_SECRET });
  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = new Set(
        [
          env.RAGI_WEB_ORIGIN,
          env.RAGI_PUBLIC_ORIGIN,
          "http://127.0.0.1:4173",
          "http://localhost:4173",
          "http://127.0.0.1:8765",
          "http://localhost:8765",
          "https://arnold-rg.github.io",
        ]
          .filter(Boolean)
          .flatMap((o) => o.split(",").map((x) => x.trim())),
      );
      if (!origin || allowed.has(origin) || !isProd) cb(null, true);
      else cb(new Error("CORS blocked"), false);
    },
    credentials: true,
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    hook: "onRequest",
  });

  app.addHook("onRequest", async (req, reply) => {
    const id = String(req.headers["x-request-id"] ?? randomUUID());
    req.headers["x-request-id"] = id;
    reply.header("x-request-id", id);
  });

  await registerAuthGuard(app);

  app.setErrorHandler((err: unknown, req, reply) => {
    req.log.error({ err }, "request failed");
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({
        error: err.code,
        message: err.message,
        details: err.details,
        requestId: req.headers["x-request-id"],
      });
    }
    if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "ZodError") {
      return reply.code(400).send({
        error: "validation_failed",
        details: err,
        requestId: req.headers["x-request-id"],
      });
    }
    const status =
      typeof err === "object" && err && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 500;
    const message = err instanceof Error ? err.message : "internal_error";
    return reply.code(status || 500).send({
      error: status && status < 500 ? message : "internal_error",
      requestId: req.headers["x-request-id"],
    });
  });
}
