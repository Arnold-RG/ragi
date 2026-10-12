import pino from "pino";
import { env, isProd } from "./config.js";

export const logger = pino({
  level: isProd ? "info" : "debug",
  base: { service: "ragi-backend", env: env.NODE_ENV },
});
