import { env } from "../../shared/config.js";
import { db } from "../../shared/db.js";
import { withOwnerVault } from "../../shared/vault.js";
import { touchVault } from "../../shared/storage/persist.js";

type GhRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  archived: boolean;
  fork: boolean;
  private: boolean;
  size: number;
  stargazers_count: number;
  open_issues_count: number;
  has_pages: boolean;
  homepage: string | null;
  topics?: string[];
  license: { spdx_id?: string } | null;
  pushed_at: string;
  updated_at: string;
  default_branch: string;
};

/** Heuristic creation completeness from public GitHub signals (0–100). */
export function estimateRepoProgress(r: GhRepo): number {
  let p = 0;
  if (r.description && r.description.trim().length > 8) p += 12;
  if (r.language) p += 12;
  if (r.size > 0) p += 18;
  if (r.size > 200) p += 8;
  if ((r.topics?.length ?? 0) > 0) p += 8;
  if (r.license?.spdx_id) p += 8;
  if (r.homepage || r.has_pages) p += 10;
  if (!r.archived) p += 4;
  if (!r.fork) p += 4;

  const days = Math.max(
    0,
    (Date.now() - new Date(r.pushed_at).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 14) p += 16;
  else if (days <= 60) p += 10;
  else if (days <= 180) p += 5;

  return Math.min(100, Math.round(p));
}

async function fetchGithubRepos(login: string): Promise<GhRepo[]> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "RAGI-secretary",
    "x-github-api-version": "2022-11-28",
  };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const out: GhRepo[] = [];
  let page = 1;
  while (page <= 10) {
    const url = `https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&page=${page}&sort=updated&type=all`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`github_${res.status}:${text.slice(0, 200)}`);
    }
    const batch = (await res.json()) as GhRepo[];
    out.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return out;
}

export async function listGithubProjects(ownerId: string) {
  const login = env.GITHUB_USERNAME || "Arnold-RG";
  const repos = await fetchGithubRepos(login);
  const tracks = await db.githubRepoTrack.findMany({ where: { ownerId } });
  const trackMap = new Map(tracks.map((t) => [t.fullName, t]));

  const projects = repos.map((r) => {
      const auto = estimateRepoProgress(r);
      const track = trackMap.get(r.full_name);
      const progress = track ? track.progress : auto;
      const remaining = Math.max(0, 100 - progress);
      return {
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        url: r.html_url,
        description: r.description ?? "",
        language: r.language,
        private: r.private,
        archived: r.archived,
        stars: r.stargazers_count,
        openIssues: r.open_issues_count,
        pushedAt: r.pushed_at,
        autoProgress: auto,
        progress,
        remaining,
        overridden: Boolean(track),
        fork: r.fork,
        source: "github" as const,
      };
    }).sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name));

  const avg =
    projects.length === 0
      ? 0
      : Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length);

  return {
    login,
    fetchedAt: new Date().toISOString(),
    authenticated: Boolean(env.GITHUB_TOKEN),
    count: projects.length,
    avgProgress: avg,
    avgRemaining: Math.max(0, 100 - avg),
    projects,
  };
}

export async function setGithubProgress(
  ownerId: string,
  fullName: string,
  progress: number,
  notes?: string,
) {
  const { enc } = await withOwnerVault(ownerId);
  const row = await db.githubRepoTrack.upsert({
    where: { ownerId_fullName: { ownerId, fullName } },
    create: {
      ownerId,
      fullName,
      progress: Math.min(100, Math.max(0, progress)),
      notesEnc: notes ? enc(notes) : null,
    },
    update: {
      progress: Math.min(100, Math.max(0, progress)),
      notesEnc: notes !== undefined ? (notes ? enc(notes) : null) : undefined,
    },
  });
  touchVault(ownerId, "github-track");
  return {
    fullName: row.fullName,
    progress: row.progress,
    remaining: Math.max(0, 100 - row.progress),
  };
}
