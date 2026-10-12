import { availableParallelism } from "node:os";
import { env, memoryProfile } from "../config.js";

export function runtimeReport() {
  const mem = process.memoryUsage();
  const mb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;
  return {
    ...memoryProfile(),
    process: {
      rssMb: mb(mem.rss),
      heapUsedMb: mb(mem.heapUsed),
      heapTotalMb: mb(mem.heapTotal),
      externalMb: mb(mem.external),
      arrayBuffersMb: mb(mem.arrayBuffers),
    },
    cpusAvailable: availableParallelism(),
    configuredWorkerThreads: env.RAGI_WORKER_THREADS,
  };
}
