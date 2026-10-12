import { Redis } from "ioredis";
import { env } from "../config.js";
import { logger } from "./logger.js";

type MemoryEntry = { value: string; expiresAt: number };

class MemoryStore {
  private map = new Map<string, MemoryEntry>();
  private budgetBytes: number;
  private usedBytes = 0;

  constructor(budgetMb: number) {
    this.budgetBytes = budgetMb * 1024 * 1024;
  }

  async get(key: string): Promise<string | null> {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const size = Buffer.byteLength(key) + Buffer.byteLength(value);
    if (this.usedBytes + size > this.budgetBytes) {
      this.evict(Math.ceil(this.budgetBytes * 0.1));
    }
    const prev = this.map.get(key);
    if (prev) this.usedBytes -= Buffer.byteLength(key) + Buffer.byteLength(prev.value);
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    this.usedBytes += size;
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const cur = Number((await this.get(key)) ?? "0") + 1;
    await this.set(key, String(cur), ttlSeconds);
    return cur;
  }

  delete(key: string): void {
    const prev = this.map.get(key);
    if (!prev) return;
    this.usedBytes -= Buffer.byteLength(key) + Buffer.byteLength(prev.value);
    this.map.delete(key);
  }

  private evict(bytesNeeded: number) {
    let freed = 0;
    for (const [k, v] of this.map) {
      this.map.delete(k);
      freed += Buffer.byteLength(k) + Buffer.byteLength(v.value);
      this.usedBytes -= Buffer.byteLength(k) + Buffer.byteLength(v.value);
      if (freed >= bytesNeeded) break;
    }
  }

  stats() {
    return { keys: this.map.size, usedBytes: this.usedBytes, budgetBytes: this.budgetBytes };
  }
}

const memory = new MemoryStore(env.RAGI_CACHE_BUDGET_MB);
let redis: Redis | null = null;

export async function initCache() {
  if (!env.REDIS_URL) {
    logger.info({ store: "memory", budgetMb: env.RAGI_CACHE_BUDGET_MB }, "cache ready");
    return;
  }
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  await redis.connect();
  logger.info({ store: "redis" }, "cache ready");
}

export async function cacheGet(key: string): Promise<string | null> {
  if (redis) return redis.get(key);
  return memory.get(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (redis) {
    await redis.set(key, value, "EX", ttlSeconds);
    return;
  }
  await memory.set(key, value, ttlSeconds);
}

export async function cacheIncr(key: string, ttlSeconds: number): Promise<number> {
  if (redis) {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, ttlSeconds);
    return n;
  }
  return memory.incr(key, ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  if (redis) {
    await redis.del(key);
    return;
  }
  memory.delete(key);
}

export function cacheStats() {
  return {
    backend: redis ? "redis" : "memory",
    memory: memory.stats(),
  };
}

export async function closeCache() {
  if (redis) await redis.quit();
}
