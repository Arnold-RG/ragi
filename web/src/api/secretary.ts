import { api } from "./client";
import { getToken } from "../state/session";
import { isLocalToken } from "../vault/localAuth";
import { localCreateNote, localListNotes } from "../vault/localLife";
import {
  localChatAi,
  localGetBriefing,
  localGetMode,
  localSetMode,
} from "../vault/localSecretary";

function useLocal() {
  return isLocalToken(getToken());
}

export function getMode() {
  if (useLocal()) return localGetMode();
  return api<{ mode: string }>("/api/v1/mode");
}

export function setMode(mode: "work" | "personal") {
  if (useLocal()) return localSetMode(mode);
  return api<{ mode: string }>("/api/v1/mode", {
    method: "PUT",
    body: JSON.stringify({ mode }),
  });
}

export function getBriefing() {
  if (useLocal()) return localGetBriefing();
  return api<{
    source: string;
    generatedAt: string;
    briefing: { summary: string; openJobs: number; mode: string };
  }>("/api/v1/briefing");
}

export function listJobs() {
  return api<{
    jobs: Array<{
      id: string;
      title: string;
      company: string | null;
      status: string;
    }>;
  }>("/api/v1/jobs");
}

export function createJob(input: { title: string; company?: string; status?: string }) {
  return api<{ id: string; status: string }>("/api/v1/jobs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listFocus() {
  return api<{
    blocks: Array<{ id: string; label: string; startsAt: string; endsAt: string; completed: boolean }>;
  }>("/api/v1/focus");
}

export function completeFocus(id: string) {
  return api<{ ok: boolean }>(`/api/v1/focus/${id}/complete`, { method: "POST" });
}

export function deleteJob(id: string) {
  return api<{ ok: boolean }>(`/api/v1/jobs/${id}`, { method: "DELETE" });
}

export function createFocus(input: { label: string; startsAt: string; endsAt: string }) {
  return api<{ id: string }>("/api/v1/focus", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function chatAi(message: string, mode?: "work" | "personal") {
  if (useLocal()) return localChatAi(message, mode);
  return api<{ reply: string; mode: string; model: string; signal?: string }>("/api/v1/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message, mode }),
  });
}

export function listNotes() {
  if (isLocalToken(getToken())) return localListNotes();
  return api<{
    notes: Array<{ id: string; kind: string; title: string; body: string; updatedAt: string }>;
  }>("/api/v1/notes");
}

export function createNote(input: { kind?: string; title: string; body?: string }) {
  if (isLocalToken(getToken())) return localCreateNote(input);
  return api<{ id: string }>("/api/v1/notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
