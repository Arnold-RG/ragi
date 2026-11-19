import { getDashboard } from "../life/dashboard.js";

function money(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Offline vault brain — answers from real owner data when Gemini is absent. */
export async function localSecretaryReply(
  ownerId: string,
  message: string,
  mode: string,
): Promise<string> {
  const dash = await getDashboard(ownerId);
  const q = message.toLowerCase();

  if (/\b(balance|finance|money|budget|spend|cash)\b/.test(q)) {
    return [
      `Ledger (${mode}): balance ${money(dash.finance.balanceCents)}.`,
      `Income ${money(dash.finance.incomeCents)} · out ${money(dash.finance.expenseCents)}.`,
      dash.finance.recent[0]
        ? `Last: ${dash.finance.recent[0].label} (${dash.finance.recent[0].kind} ${money(dash.finance.recent[0].amountCents)}).`
        : "No finance rows yet — open G-55 GOLD to post income/expense.",
    ].join(" ");
  }

  if (/\b(project|forge|build)\b/.test(q)) {
    if (!dash.projects.length) {
      return "No projects yet. Open F-33 FORGE and add a personal or work project with a progress %.";
    }
    const lines = dash.projects
      .slice(0, 5)
      .map((p) => `• ${p.title} [${p.realm}] ${p.progress}% (${p.status})`);
    return `Projects (${dash.projects.length}):\n${lines.join("\n")}`;
  }

  if (/\b(goal|target)\b/.test(q)) {
    if (!dash.goals.length) return "No goals sealed. Add them under F-33 FORGE.";
    return dash.goals
      .slice(0, 5)
      .map((g) => `• ${g.title} ${g.progress}%`)
      .join("\n");
  }

  if (/\b(meeting|calendar|schedule)\b/.test(q)) {
    if (!dash.meetingsUpcoming.length) {
      return "No upcoming meetings. Log them in C-88 CLOCK.";
    }
    return dash.meetingsUpcoming
      .slice(0, 5)
      .map((m) => `• ${m.title} @ ${new Date(m.startsAt).toLocaleString()}`)
      .join("\n");
  }

  if (/\b(remind|reminder|todo)\b/.test(q)) {
    const open = dash.reminders.filter((r) => !r.done);
    if (!open.length) return "Reminder board clear.";
    return open
      .slice(0, 6)
      .map((r) => `• [${r.priority}] ${r.title} · ${new Date(r.dueAt).toLocaleString()}`)
      .join("\n");
  }

  if (/\b(emergenc|crisis|urgent|sos)\b/.test(q)) {
    const live = dash.emergencies.filter((e) => e.active);
    if (!live.length) return "No active emergencies. Keep a plan in C-88 CLOCK if you need one.";
    return live.map((e) => `⚠ ${e.severity.toUpperCase()}: ${e.title} — ${e.body}`).join("\n");
  }

  if (/\b(today|daily|activit|plan)\b/.test(q)) {
    if (!dash.activitiesToday.length) {
      return "No activities for today. Add daily tasks in F-33 FORGE.";
    }
    const done = dash.activitiesToday.filter((a) => a.done).length;
    return `Today ${done}/${dash.activitiesToday.length} done.\n${dash.activitiesToday
      .map((a) => `${a.done ? "[x]" : "[ ]"} ${a.title}`)
      .join("\n")}`;
  }

  if (/\b(job|quest|career)\b/.test(q)) {
    return dash.openJobs
      ? `Quest log: ${dash.openJobs} open track(s). Mode ${dash.mode}.`
      : "Quest log empty. Add roles from the HALL panel.";
  }

  if (/\b(status|brief|report|summary|dashboard|home)\b/.test(q) || /^hey\s*ragi/.test(q)) {
    return [
      `RAGI local signal · mode ${dash.mode}.`,
      `Projects ${dash.projects.length} (avg ${dash.charts.projectAvgProgress}%).`,
      `Goals ${dash.goals.length}. Today tasks ${dash.activitiesToday.filter((a) => a.done).length}/${dash.activitiesToday.length}.`,
      `Meetings soon ${dash.meetingsUpcoming.length}. Reminders open ${dash.reminders.filter((r) => !r.done).length}.`,
      `Emergencies active ${dash.emergencies.filter((e) => e.active).length}.`,
      `Cash ${money(dash.finance.balanceCents)}. Focus ${dash.focusActive ? "locked" : "clear"}.`,
      "Rooms: H-01 HOME · F-33 FORGE · G-55 GOLD · C-88 CLOCK · M-99 MAP.",
    ].join(" ");
  }

  return [
    `Heard you in ${mode} mode (local secretary — Gemini key not set).`,
    `Vault: ${dash.projects.length} projects, ${dash.goals.length} goals, balance ${money(dash.finance.balanceCents)}.`,
    "Ask about balance, projects, meetings, reminders, today, or status — or set GEMINI_API_KEY in backend/.env for cloud talk.",
  ].join(" ");
}
