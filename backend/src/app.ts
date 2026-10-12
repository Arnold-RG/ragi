import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import { env, isProd } from "./config.js";
import { logger } from "./lib/logger.js";
import { registerAuthGuard } from "./plugins/auth-guard.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { secretaryRoutes } from "./routes/secretary.js";
import { calendarRoutes } from "./routes/calendar.js";
import { aiRoutes } from "./routes/ai.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
    requestTimeout: 120000,
  });
  void logger;

  await app.register(sensible);
  await app.register(cookie, {
    secret: env.RAGI_SESSION_SECRET,
  });
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });
  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = new Set(
        [env.RAGI_WEB_ORIGIN, env.RAGI_PUBLIC_ORIGIN, "http://127.0.0.1:8765", "http://localhost:8765"]
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

  await registerAuthGuard(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(secretaryRoutes);
  await app.register(calendarRoutes);
  await app.register(aiRoutes);

  app.setErrorHandler((err: unknown, req, reply) => {
    req.log.error({ err }, "request failed");
    if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "ZodError") {
      return reply.code(400).send({ error: "validation_failed", details: err });
    }
    const status =
      typeof err === "object" && err && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 500;
    const message = err instanceof Error ? err.message : "internal_error";
    return reply.code(status || 500).send({
      error: status && status < 500 ? message : "internal_error",
    });
  });

  return app;
}
