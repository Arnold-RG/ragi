import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient({
  log: ["error", "warn"],
});

export async function dbReady(): Promise<boolean> {
  await db.$queryRaw`SELECT 1`;
  return true;
}
