import Fastify from "fastify";
import { registerPlugins } from "./bootstrap/plugins.js";
import { registerRoutes } from "./bootstrap/routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
    requestTimeout: 120000,
  });

  await registerPlugins(app);
  await registerRoutes(app);
  return app;
}
