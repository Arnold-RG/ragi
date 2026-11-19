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

  app.get("/api/v1/storage/status", async (req) => {
    const st = storageStatus(req.ragiOwnerId!);
    const latest = st.latestSnapshot;
    return {
      engine: st.engine,
      durable: st.durable,
      snapshotCount: st.snapshotCount,
      latestSnapshot: latest
        ? { id: latest.id, createdAt: latest.createdAt, bytes: latest.bytes }
        : null,
      note: "Each account's snapshots are its own. A restore merges into your vault and does not touch anyone else's.",
    };
  });

  app.get("/api/v1/storage/export", async (req) => exportVault(req.ragiOwnerId!));

  app.get("/api/v1/storage/snapshots", async (req) => ({
    snapshots: listSnapshots(req.ragiOwnerId!).map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      bytes: s.bytes,
      counts: s.counts ?? null,
    })),
  }));

  app.post("/api/v1/storage/snapshot", async (req) => {
    const body = z.object({ reason: z.string().optional() }).parse(req.body ?? {});
    const snap = await createSnapshot(req.ragiOwnerId!, body.reason ?? "manual");
    return {
      ok: true,
      snapshot: { id: snap.id, createdAt: snap.createdAt, bytes: snap.bytes },
    };
  });

  app.get("/api/v1/storage/snapshots/:id", async (req, reply) => {
    const params = z.object({ id: z.string().min(4) }).parse(req.params);
    try {
      return loadSnapshotJson(params.id, req.ragiOwnerId!);
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
        payload = loadSnapshotJson(body.snapshotId, req.ragiOwnerId!) as VaultExport;
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
      return { ok: true, snapshot: { id: forced.id, createdAt: forced.createdAt, bytes: forced.bytes } };
    }
    return { ok: true, snapshot: { id: snap.id, createdAt: snap.createdAt, bytes: snap.bytes } };
  });
};
