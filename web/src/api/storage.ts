import { api } from "./client";

export type StorageStatus = {
  dataRoot: string;
  backupsRoot: string;
  sqlitePath: string | null;
  sqliteExists: boolean;
  engine: string;
  snapshotCount: number;
  latestSnapshot: {
    id: string;
    createdAt: string;
    bytes: number;
    counts?: Record<string, number>;
  } | null;
  durable: boolean;
  note: string;
};

export type SnapshotMeta = {
  id: string;
  createdAt: string;
  bytes: number;
  counts?: Record<string, number>;
};

export function storageStatus() {
  return api<StorageStatus>("/api/v1/storage/status");
}

export function listSnapshots() {
  return api<{ snapshots: SnapshotMeta[] }>("/api/v1/storage/snapshots");
}

export function takeSnapshot(reason?: string) {
  return api<{ ok: boolean; snapshot: SnapshotMeta }>("/api/v1/storage/snapshot", {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? "manual" }),
  });
}

export function exportVault() {
  return api<Record<string, unknown>>("/api/v1/storage/export");
}

export function restoreSnapshot(snapshotId: string) {
  return api<{ ok: boolean; added: number; mode: string }>("/api/v1/storage/restore", {
    method: "POST",
    body: JSON.stringify({ snapshotId, mode: "merge" }),
  });
}

export function getSnapshot(id: string) {
  return api<Record<string, unknown>>(`/api/v1/storage/snapshots/${id}`);
}
