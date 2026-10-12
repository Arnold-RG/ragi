import { api } from "./client";

export function getMode() {
  return api<{ mode: string }>("/api/v1/mode");
}

export function setMode(mode: "work" | "personal") {
  return api<{ mode: string }>("/api/v1/mode", {
    method: "PUT",
    body: JSON.stringify({ mode }),
  });
}

export function getBriefing() {
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

export function createFocus(input: { label: string; startsAt: string; endsAt: string }) {
  return api<{ id: string }>("/api/v1/focus", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function chatAi(message: string, mode?: "work" | "personal") {
  return api<{ reply: string; mode: string; model: string }>("/api/v1/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message, mode }),
  });
}

export function listNotes() {
  return api<{
    notes: Array<{ id: string; kind: string; title: string; body: string; updatedAt: string }>;
  }>("/api/v1/notes");
}

export function createNote(input: { kind?: string; title: string; body?: string }) {
  return api<{ id: string }>("/api/v1/notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
