import { api } from "./client";

export type GhProject = {
  name: string;
  fullName: string;
  url: string;
  description: string;
  language: string | null;
  progress: number;
  remaining: number;
  autoProgress: number;
  overridden: boolean;
  pushedAt: string;
  stars: number;
  fork: boolean;
};

export function listGithubRepos() {
  return api<{
    login: string;
    fetchedAt: string;
    authenticated: boolean;
    count: number;
    avgProgress: number;
    avgRemaining: number;
    projects: GhProject[];
  }>("/api/v1/github/repos");
}

export function setGithubProgress(fullName: string, progress: number) {
  return api<{ fullName: string; progress: number; remaining: number }>(
    "/api/v1/github/progress",
    {
      method: "PUT",
      body: JSON.stringify({ fullName, progress }),
    },
  );
}
