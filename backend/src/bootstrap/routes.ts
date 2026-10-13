import type { FastifyInstance } from "fastify";
import { healthRoutes } from "../modules/health/routes.js";
import { authRoutes } from "../modules/auth/routes.js";
import { secretaryRoutes } from "../modules/secretary/routes.js";
import { lifeRoutes } from "../modules/life/routes.js";
import { storageRoutes } from "../modules/storage/routes.js";
import { githubRoutes } from "../modules/github/routes.js";
import { calendarRoutes } from "../modules/calendar/routes.js";
import { aiRoutes } from "../modules/ai/routes.js";
import { systemRoutes } from "../modules/system/routes.js";

/** Single registry — keeps HTTP surface aligned and ordered. */
export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(systemRoutes);
  await app.register(authRoutes);
  await app.register(secretaryRoutes);
  await app.register(lifeRoutes);
  await app.register(storageRoutes);
  await app.register(githubRoutes);
  await app.register(calendarRoutes);
  await app.register(aiRoutes);
}
