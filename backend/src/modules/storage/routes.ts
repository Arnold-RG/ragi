import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { exportVault, type VaultExport } from "../../shared/storage/export-vault.js";
import { importVaultMerge } from "../../shared/storage/import-vault.js";
import {
  createSnapshot,
  listSnapshots,
  loadSnapshotJson,
  storageStatus,
} from "../../shared/storage/snapshots.js";
import { flushVault } from "../../shared/storage/persist.js";

export const storageRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireOwner);

  app.get("/api/v1/storage/status", async () => storageStatus());

  app.get("/api/v1/storage/export", async (req) => exportVault(req.ragiOwnerId!));

  app.get("/api/v1/storage/snapshots", async () => ({ snapshots: listSnapshots() }));

  app.post("/api/v1/storage/snapshot", async (req) => {
    const body = z.object({ reason: z.string().optional() }).parse(req.body ?? {});
    const snap = await createSnapshot(req.ragiOwnerId!, body.reason ?? "manual");
    return { ok: true, snapshot: snap };
  });

  app.get("/api/v1/storage/snapshots/:id", async (req, reply) => {
    const params = z.object({ id: z.string().min(4) }).parse(req.params);
    try {
      return loadSnapshotJson(params.id);
    } catch {
      return reply.code(404).send({ error: "snapshot_not_found" });
    }
  });

  app.post("/api/v1/storage/restore", async (req, reply) => {
    const body = z
      .object({
        snapshotId: z.string().optional(),
        payload: z.unknown().optional(),
        mode: z.literal("merge").default("merge"),
      })
      .parse(req.body);

    let payload: VaultExport | null = null;
    if (body.snapshotId) {
      try {
        payload = loadSnapshotJson(body.snapshotId) as VaultExport;
      } catch {
        return reply.code(404).send({ error: "snapshot_not_found" });
      }
    } else if (body.payload && typeof body.payload === "object") {
      payload = body.payload as VaultExport;
    }

    if (!payload || payload.format !== "ragi-vault-v1") {
      return reply.code(400).send({ error: "invalid_vault_payload" });
    }

    // Merge only — never wipe. Owner seals stay immutable.
    const result = await importVaultMerge(req.ragiOwnerId!, payload);
    await createSnapshot(req.ragiOwnerId!, `restore-${body.snapshotId ?? "upload"}`);
    return result;
  });

  app.post("/api/v1/storage/flush", async (req) => {
    const snap = await flushVault();
    if (!snap) {
      const forced = await createSnapshot(req.ragiOwnerId!, "flush");
      return { ok: true, snapshot: forced };
    }
    return { ok: true, snapshot: snap };
  });
};
