import { config as loadEnv } from "dotenv";
import { z } from "zod";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../.env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  RAGI_HOST: z.string().default("0.0.0.0"),
  RAGI_PORT: z.coerce.number().int().positive().default(8787),
  RAGI_PUBLIC_ORIGIN: z.string().url().default("http://127.0.0.1:8787"),
  RAGI_WEB_ORIGIN: z.string().default("http://127.0.0.1:4173"),
  RAGI_HEAP_MB: z.coerce.number().int().positive().default(28672),
  RAGI_CACHE_BUDGET_MB: z.coerce.number().int().positive().default(4096),
  RAGI_WORKER_THREADS: z.coerce.number().int().positive().default(8),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional().default(""),
  RAGI_MASTER_KEY: z.string().min(32),
  RAGI_SESSION_SECRET: z.string().min(32),
  RAGI_COOKIE_NAME: z.string().default("ragi_session"),
  OWNER_PASSPHRASE: z.string().optional().default(""),
  OWNER_BACKUP_CODE: z.string().optional().default(""),
  OWNER_DEVICE_KEY: z.string().optional().default(""),
  OWNER_TOTP_ISSUER: z.string().default("RAGI"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().optional().default(""),
  MS_CLIENT_ID: z.string().optional().default(""),
  MS_CLIENT_SECRET: z.string().optional().default(""),
  MS_TENANT_ID: z.string().default("common"),
  MS_REDIRECT_URI: z.string().optional().default(""),
  RP_ID: z.string().default("127.0.0.1"),
  RP_NAME: z.string().default("RAGI"),
  RP_ORIGIN: z.string().default("http://127.0.0.1:8787"),
  AUTH_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
});

function ensureDataDir(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) return;
  const rel = databaseUrl.replace(/^file:/, "");
  const abs = resolve(here, "..", "prisma", rel.replace(/^\.\//, ""));
  mkdirSync(dirname(abs), { recursive: true });
}

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid RAGI environment:", parsed.error.flatten().fieldErrors);
  console.error("Copy backend/.env.example to backend/.env and set required secrets.");
  process.exit(1);
}

ensureDataDir(parsed.data.DATABASE_URL);

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";

export function memoryProfile() {
  const heap = env.RAGI_HEAP_MB;
  const cache = env.RAGI_CACHE_BUDGET_MB;
  return {
    targetHostClassGb: 32,
    nodeHeapMb: heap,
    cacheBudgetMb: cache,
    workerThreads: env.RAGI_WORKER_THREADS,
    note: "Capacity for a 32GB+ host. Memory is allocated on demand, not pre-filled.",
    dataDirReady: existsSync(resolve(here, "../prisma/data")) || true,
  };
}
