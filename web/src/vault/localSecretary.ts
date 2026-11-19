/**
 * On-device secretary when Pages has no AI API — answers from live vault + GitHub intel.
 */

import { getSessionMeta } from "../state/session";
import { localGetDashboard, localListGithubRepos } from "./localLife";
import type { GithubIntel } from "./githubIntel";

let mode: "work" | "personal" = "work";

export async function localGetMode() {
  return { mode };
}

export async function localSetMode(next: "work" | "personal") {
  mode = next;
  return { mode };
}

async function snapshot() {
  const dash = await localGetDashboard();
  let gh: Awaited<ReturnType<typeof localListGithubRepos>> | null = null;
  try {
    gh = await localListGithubRepos();
  } catch {
    gh = null;
  }
  return { dash, gh };
}

function intelLine(gh: Awaited<ReturnType<typeof localListGithubRepos>> | null) {
  if (!gh || gh.needsLogin || !gh.intel) {
    return "GitHub is not connected yet — open Work and connect your username for production, pace, and error analytics.";
  }
  const i = gh.intel;
  return (
    `GitHub @${i.login}: production ${i.productionPercent}%, performance ${i.performanceScore}/100, ` +
    `time management ${i.timeManagementScore}/100, error pressure ${i.errorRatePercent}%. ` +
    `${i.stats.activeRepos7d}/${i.stats.repoCount} repos active in 7 days · ~${i.stats.commitsApprox14d} commits / 14d.`
  );
}

export async function localGetBriefing() {
  const { dash, gh } = await snapshot();
  const handle = getSessionMeta()?.handle ?? "chief";
  const openTasks = dash.activitiesToday.filter((a) => !a.done).length;
  const nextCall = dash.meetingsUpcoming[0];
  const parts = [
    `${handle}: ${openTasks} open tasks today, ${dash.projects.length} projects, balance $${(dash.finance.balanceCents / 100).toFixed(2)}.`,
    nextCall
      ? `Next call “${nextCall.title}” at ${new Date(nextCall.startsAt).toLocaleString()}.`
      : "No calls on the board.",
    intelLine(gh),
  ];
  if (gh?.intel?.feedback?.[0]) parts.push(gh.intel.feedback[0]);

  return {
    source: "local-vault",
    generatedAt: new Date().toISOString(),
    briefing: {
      summary: parts.join(" "),
      openJobs: openTasks,
      mode,
    },
  };
}

function rankReply(message: string, intel: GithubIntel | null | undefined, dash: Awaited<ReturnType<typeof localGetDashboard>>) {
  const q = message.toLowerCase();
  const openTasks = dash.activitiesToday.filter((a) => !a.done);
  const doneTasks = dash.activitiesToday.filter((a) => a.done);

  if (/github|repo|production|performance|error rate|time management|pace|commit/.test(q)) {
    if (!intel) {
      return (
        "Connect GitHub in Work (your public username). Once linked, I measure production %, work performance, " +
        "time management, and error/issue pressure from public activity — then I coach you against that scoreboard."
      );
    }
    const lines = [
      `Here is your live GitHub readout for @${intel.login}:`,
      `• Production: ${intel.productionPercent}% (repo completion + issue closure signal)`,
      `• Work performance: ${intel.performanceScore}/100 (~${intel.stats.commitsApprox14d} commits, ${intel.stats.pushes14d} pushes in 14 days)`,
      `• Time management: ${intel.timeManagementScore}/100 (${intel.stats.activeRepos7d} active / ${intel.stats.staleRepos30d} stale 30d+)`,
      `• Error pressure: ${intel.errorRatePercent}% (open vs closed issues on top repos)`,
      "",
      ...intel.feedback.map((f) => `→ ${f}`),
    ];
    if (/which|focus|priority|next/.test(q)) {
      const hot = [...intel.projects].sort((a, b) => a.remaining - b.remaining).slice(0, 3);
      const stale = intel.projects.filter((p) => (p.daysSincePush ?? 0) > 30).slice(0, 3);
      lines.push("", "Focus next:");
      hot.forEach((p) => lines.push(`• Finish push on ${p.name} (${p.progress}% · ${p.remaining}% left)`));
      if (stale.length) {
        lines.push("Quiet repos to decide on:");
        stale.forEach((p) => lines.push(`• ${p.name} — ${p.daysSincePush}d since last push`));
      }
    }
    return lines.join("\n");
  }

  if (/task|todo|today|what should i/.test(q)) {
    if (!openTasks.length) {
      return "Your task board is clear. Add the next concrete move in Today, or ask me to prioritize GitHub repos.";
    }
    const list = openTasks
      .slice(0, 6)
      .map((t, i) => `${i + 1}. ${t.title}`)
      .join("\n");
    return (
      `You have ${openTasks.length} open tasks (${doneTasks.length} done today).\n${list}\n\n` +
      `Do #1 in a 25-minute focus block. If a call is soon, clear the shortest task first.`
    );
  }

  if (/money|cash|finance|spend|income|budget/.test(q)) {
    const f = dash.finance;
    return (
      `Money board: income $${(f.incomeCents / 100).toFixed(2)}, spent $${(f.expenseCents / 100).toFixed(2)}, ` +
      `balance $${(f.balanceCents / 100).toFixed(2)}. ` +
      (f.balanceCents < 0
        ? "Balance is negative — pause non-essential spend and log every outlay today."
        : "Balance is positive — protect it by logging expenses the same day.")
    );
  }

  if (/call|meeting|schedule|remind/.test(q)) {
    if (!dash.meetingsUpcoming.length && !dash.reminders.length) {
      return "Schedule is clear. Book your next call in Schedule so I can protect focus time around it.";
    }
    const calls = dash.meetingsUpcoming
      .slice(0, 4)
      .map((m) => `• ${m.title} — ${new Date(m.startsAt).toLocaleString()}${m.place ? ` @ ${m.place}` : ""}`)
      .join("\n");
    const rems = dash.reminders
      .slice(0, 4)
      .map((r) => `• ${r.title} (${r.priority}) — ${new Date(r.dueAt).toLocaleString()}`)
      .join("\n");
    return `Calls:\n${calls || "• none"}\n\nReminders:\n${rems || "• none"}\n\nArrive 5 minutes early and keep one task buffer after each call.`;
  }

  if (/project|goal|progress|productivity/.test(q)) {
    const projs = dash.projects
      .slice(0, 5)
      .map((p) => `• ${p.title} — ${p.progress}% (${p.realm})`)
      .join("\n");
    const goals = dash.goals
      .slice(0, 4)
      .map((g) => `• ${g.title} — ${g.progress}%`)
      .join("\n");
    return (
      `Projects (avg ${dash.charts.projectAvgProgress}%):\n${projs || "• none yet"}\n\n` +
      `Goals (avg ${dash.charts.goalAvgProgress}%):\n${goals || "• none yet"}\n\n` +
      `Direction: ${dash.charts.direction}. Bump the lowest project by +10% today with one shipped artifact.`
    );
  }

  if (/help|what can you|secretary|assistant/.test(q)) {
    return (
      "I am your private secretary for this vault. I can:\n" +
      "• Read GitHub production %, performance, time management, and error pressure\n" +
      "• Prioritize tasks, calls, and project progress\n" +
      "• Summarize money and reminders\n" +
      "Ask things like: “How is my GitHub performance?” or “What should I do next?”"
    );
  }

  // Default: full executive brief
  const ghBit = intel
    ? `GitHub production ${intel.productionPercent}% · pace ${intel.performanceScore}/100 · errors ${intel.errorRatePercent}%.`
    : "GitHub not connected.";
  return (
    `Executive brief (${mode} mode):\n` +
    `• Tasks: ${openTasks.length} open / ${doneTasks.length} done\n` +
    `• Projects: ${dash.projects.length} (avg ${dash.charts.projectAvgProgress}%)\n` +
    `• Calls: ${dash.meetingsUpcoming.length} · Reminders: ${dash.reminders.length}\n` +
    `• Cash: $${(dash.finance.balanceCents / 100).toFixed(2)}\n` +
    `• ${ghBit}\n\n` +
    (intel?.feedback?.[0] ?? "Connect GitHub in Work for deeper production analytics.") +
    `\n\nAsk a sharper question for a sharper answer.`
  );
}

export async function localChatAi(message: string, nextMode?: "work" | "personal") {
  if (nextMode === "work" || nextMode === "personal") mode = nextMode;
  const { dash, gh } = await snapshot();
  const reply = rankReply(message, gh?.intel, dash);
  return {
    reply,
    mode,
    model: "ragi-local-secretary",
    signal: gh?.intel ? "github-linked" : "vault-only",
  };
}
