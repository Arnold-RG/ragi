import { api } from "./client";
import { getToken } from "../state/session";
import { isLocalToken } from "../vault/localAuth";
import {
  localListGithubRepos,
  localSetGithubLogin,
  localSetGithubProgress,
} from "../vault/localLife";

import type { GithubIntel } from "../vault/githubIntel";

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
  openIssues?: number;
  daysSincePush?: number;
};

export type GithubReposResponse = {
  login: string;
  fetchedAt: string;
  authenticated: boolean;
  needsLogin?: boolean;
  count: number;
  avgProgress: number;
  avgRemaining: number;
  projects: GhProject[];
  intel?: GithubIntel;
};

export function listGithubRepos() {
  if (isLocalToken(getToken())) return localListGithubRepos();
  return api<GithubReposResponse>("/api/v1/github/repos");
}

export function setGithubLogin(login: string) {
  if (isLocalToken(getToken())) return localSetGithubLogin(login);
  return api<{ login: string }>("/api/v1/github/login", {
    method: "PUT",
    body: JSON.stringify({ login }),
  });
}

export function setGithubProgress(fullName: string, progress: number) {
  if (isLocalToken(getToken())) return localSetGithubProgress(fullName, progress);
  return api<{ fullName: string; progress: number; remaining: number }>(
    "/api/v1/github/progress",
    {
      method: "PUT",
      body: JSON.stringify({ fullName, progress }),
    },
  );
}
