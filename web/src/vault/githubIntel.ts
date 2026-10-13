/**
 * Public GitHub analytics for RAGI — production %, pace, time management, error rate.
 * Uses unauthenticated API (rate-limited). Results are cached briefly on-device.
 */

import type { GhProject } from "../api/github";

export type GithubStats = {
  repoCount: number;
  activeRepos7d: number;
  staleRepos30d: number;
  pushes14d: number;
  commitsApprox14d: number;
  openIssuesSample: number;
  closedIssuesSample: number;
  prEvents14d: number;
  issueEvents14d: number;
};

export type GithubIntel = {
  login: string;
  fetchedAt: string;
  productionPercent: number;
  performanceScore: number;
  timeManagementScore: number;
  errorRatePercent: number;
  feedback: string[];
  stats: GithubStats;
  projects: GhProject[];
  avgProgress: number;
  avgRemaining: number;
  count: number;
};

type GhRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  pushed_at: string | null;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  open_issues_count: number;
};

type GhEvent = {
  type: string;
  created_at: string;
  repo?: { name: string };
  payload?: {
    size?: number;
    action?: string;
    commits?: unknown[];
  };
};

const CACHE_MS = 8 * 60_000;
const cache = new Map<string, { at: number; intel: GithubIntel }>();

const headers: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers });
  if (res.status === 403) throw new Error("GitHub rate limit hit. Try again in a few minutes.");
  if (res.status === 404) throw new Error("GitHub user not found.");
  if (!res.ok) throw new Error(`GitHub error (${res.status}).`);
  return res.json() as Promise<T>;
}

function daysAgo(iso: string | null | undefined): number {
  if (!iso) return 999;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function withinDays(iso: string, days: number) {
  return daysAgo(iso) <= days;
}

function estimateProgress(repo: GhRepo): number {
  if (repo.archived) return 100;
  const days = daysAgo(repo.pushed_at);
  let p = 32;
  if (days < 2) p = 78;
  else if (days < 7) p = 68;
  else if (days < 14) p = 58;
  else if (days < 30) p = 48;
  else if (days < 90) p = 36;
  else if (days > 180) p = 18;
  if (repo.stargazers_count > 20) p += 6;
  else if (repo.stargazers_count > 5) p += 3;
  if (repo.fork) p -= 8;
  if (repo.open_issues_count > 15) p -= 6;
  else if (repo.open_issues_count > 5) p -= 3;
  return Math.max(5, Math.min(96, Math.round(p)));
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function buildFeedback(input: {
  production: number;
  performance: number;
  time: number;
  error: number;
  stats: GithubStats;
  topStale: string[];
}): string[] {
  const out: string[] = [];
  if (input.production >= 70) {
    out.push(`Production looks strong at ${input.production}% — keep shipping the hottest repos first.`);
  } else if (input.production >= 45) {
    out.push(`Production sits at ${input.production}%. Close one stale repo loop this week to lift the average.`);
  } else {
    out.push(`Production is at ${input.production}% — pick 1–2 repos and push daily until they clear 60%.`);
  }

  if (input.performance >= 70) {
    out.push(`Work pace is solid (${input.performance}/100) with ~${input.stats.commitsApprox14d} commits in 14 days.`);
  } else if (input.stats.pushes14d < 3) {
    out.push(`Pace is light (${input.performance}/100): only ${input.stats.pushes14d} push events in 14 days. Aim for short daily commits.`);
  } else {
    out.push(`Pace is ${input.performance}/100. Spread commits across more active repos instead of one burst.`);
  }

  if (input.time >= 70) {
    out.push(`Time management looks steady (${input.time}/100) — activity is consistent across recent days.`);
  } else if (input.stats.staleRepos30d > 3) {
    out.push(
      `Time management is ${input.time}/100. ${input.stats.staleRepos30d} repos went quiet 30+ days` +
        (input.topStale.length ? ` (e.g. ${input.topStale.slice(0, 2).join(", ")})` : "") +
        `. Archive, finish, or schedule a weekly review.`,
    );
  } else {
    out.push(`Time management is ${input.time}/100. Block 45 focused minutes daily and batch meetings away from deep work.`);
  }

  if (input.error <= 12) {
    out.push(`Error / open-issue pressure is low at ${input.error}% — quality signal is healthy.`);
  } else if (input.error <= 28) {
    out.push(`Error pressure is ${input.error}%. Triage open issues before starting new features.`);
  } else {
    out.push(`Error pressure is elevated at ${input.error}%. Freeze new scope and burn down open issues on the top repos.`);
  }

  return out;
}

export async function analyzeGithub(
  login: string,
  progressOverrides: Record<string, number> = {},
): Promise<GithubIntel> {
  const key = login.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    // Re-apply overrides on cached projects
    const projects = hit.intel.projects.map((p) => {
      const overridden = Object.prototype.hasOwnProperty.call(progressOverrides, p.fullName);
      const progress = overridden ? progressOverrides[p.fullName]! : p.autoProgress;
      return { ...p, progress, remaining: 100 - progress, overridden };
    });
    const avgProgress = projects.length
      ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
      : 0;
    return {
      ...hit.intel,
      projects,
      avgProgress,
      avgRemaining: 100 - avgProgress,
      productionPercent: avgProgress,
    };
  }

  const [repos, events] = await Promise.all([
    ghJson<GhRepo[]>(
      `https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=50&sort=updated&type=owner`,
    ),
    ghJson<GhEvent[]>(
      `https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=100`,
    ),
  ]);

  const owned = repos.filter((r) => !r.fork || daysAgo(r.pushed_at) < 60);
  const topForIssues = [...owned]
    .sort((a, b) => daysAgo(a.pushed_at) - daysAgo(b.pushed_at))
    .slice(0, 5);

  let openIssues = 0;
  let closedIssues = 0;
  await Promise.all(
    topForIssues.map(async (repo) => {
      try {
        const issues = await ghJson<Array<{ state: string; pull_request?: unknown }>>(
          `https://api.github.com/repos/${repo.full_name}/issues?state=all&per_page=30`,
        );
        for (const issue of issues) {
          if (issue.pull_request) continue;
          if (issue.state === "open") openIssues += 1;
          else closedIssues += 1;
        }
      } catch {
        /* sample best-effort */
      }
    }),
  );

  const recentEvents = events.filter((e) => withinDays(e.created_at, 14));
  const pushes14d = recentEvents.filter((e) => e.type === "PushEvent").length;
  const commitsApprox14d = recentEvents
    .filter((e) => e.type === "PushEvent")
    .reduce((s, e) => s + (e.payload?.size ?? e.payload?.commits?.length ?? 1), 0);
  const prEvents14d = recentEvents.filter((e) => e.type === "PullRequestEvent").length;
  const issueEvents14d = recentEvents.filter((e) => e.type === "IssuesEvent").length;

  const activeRepos7d = owned.filter((r) => daysAgo(r.pushed_at) <= 7).length;
  const staleRepos30d = owned.filter((r) => !r.archived && daysAgo(r.pushed_at) > 30).length;

  // Consistency: unique days with push events in last 14d
  const pushDays = new Set(
    recentEvents
      .filter((e) => e.type === "PushEvent")
      .map((e) => e.created_at.slice(0, 10)),
  );

  const projects: GhProject[] = owned.slice(0, 40).map((r) => {
    const autoProgress = estimateProgress(r);
    const overridden = Object.prototype.hasOwnProperty.call(progressOverrides, r.full_name);
    const progress = overridden ? progressOverrides[r.full_name]! : autoProgress;
    return {
      name: r.name,
      fullName: r.full_name,
      url: r.html_url,
      description: r.description ?? "",
      language: r.language,
      progress,
      remaining: 100 - progress,
      autoProgress,
      overridden,
      pushedAt: r.pushed_at ?? "",
      stars: r.stargazers_count,
      fork: r.fork,
      openIssues: r.open_issues_count,
      daysSincePush: Math.round(daysAgo(r.pushed_at)),
    };
  });

  const avgProgress = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0;

  const issueTotal = openIssues + closedIssues;
  const closureRate = issueTotal ? (closedIssues / issueTotal) * 100 : 70;
  const productionPercent = clamp(avgProgress * 0.7 + closureRate * 0.3);

  const performanceScore = clamp(
    Math.min(40, commitsApprox14d * 3) +
      Math.min(25, pushes14d * 4) +
      Math.min(20, activeRepos7d * 6) +
      Math.min(15, prEvents14d * 5),
  );

  const timeManagementScore = clamp(
    Math.min(45, pushDays.size * 7) +
      Math.min(25, activeRepos7d * 5) +
      Math.max(0, 30 - staleRepos30d * 5),
  );

  const openPressure = owned.reduce((s, r) => s + Math.min(20, r.open_issues_count), 0);
  const errorFromSample = issueTotal ? (openIssues / issueTotal) * 100 : Math.min(40, openPressure);
  const errorRatePercent = clamp(errorFromSample * 0.7 + Math.min(40, issueEvents14d * 2) * 0.3);

  const stats: GithubStats = {
    repoCount: owned.length,
    activeRepos7d,
    staleRepos30d,
    pushes14d,
    commitsApprox14d,
    openIssuesSample: openIssues,
    closedIssuesSample: closedIssues,
    prEvents14d,
    issueEvents14d,
  };

  const topStale = projects
    .filter((p) => (p.daysSincePush ?? 0) > 30)
    .sort((a, b) => (b.daysSincePush ?? 0) - (a.daysSincePush ?? 0))
    .map((p) => p.name);

  const intel: GithubIntel = {
    login,
    fetchedAt: new Date().toISOString(),
    productionPercent,
    performanceScore,
    timeManagementScore,
    errorRatePercent,
    feedback: buildFeedback({
      production: productionPercent,
      performance: performanceScore,
      time: timeManagementScore,
      error: errorRatePercent,
      stats,
      topStale,
    }),
    stats,
    projects,
    avgProgress,
    avgRemaining: 100 - avgProgress,
    count: projects.length,
  };

  cache.set(key, { at: Date.now(), intel });
  return intel;
}

export function clearGithubIntelCache(login?: string) {
  if (!login) {
    cache.clear();
    return;
  }
  cache.delete(login.toLowerCase());
}
