import {
  createActivity,
  createEmergency,
  createFinance,
  createGoal,
  createMeeting,
  createProject,
  createReminder,
  completeReminder,
  deleteActivity,
  deleteEmergency,
  deleteFinance,
  deleteGoal,
  deleteMeeting,
  deleteProject,
  deleteReminder,
  getDashboard,
  localIsoFromInput,
  money,
  patchFinance,
  patchGoal,
  patchProject,
  resolveEmergency,
  toggleActivity,
  type Dashboard,
} from "../api/life";
import { listGithubRepos, setGithubLogin, setGithubProgress } from "../api/github";
import { ApiError } from "../api/client";
import { esc, guard, meter, openRowEditor, say } from "./dom";

function productivityStrip(dash: Dashboard) {
  const done = dash.activitiesToday.filter((a) => a.done).length;
  const total = dash.activitiesToday.length;
  const calls = dash.meetingsUpcoming.length;
  const dir =
    dash.charts.direction === "forward"
      ? "Moving forward"
      : dash.charts.direction === "steady"
        ? "Steady"
        : "Needs attention";
  return `<div class="board-strip" aria-label="Productivity">
    <article class="board-metric"><p class="label">Project progress</p><p class="value">${dash.charts.projectAvgProgress}%</p><p class="note">Across ${dash.projects.length} projects</p></article>
    <article class="board-metric"><p class="label">Daily tasks</p><p class="value">${done}/${total || 0}</p><p class="note">Done today</p></article>
    <article class="board-metric"><p class="label">Calls & meetings</p><p class="value">${calls}</p><p class="note">Upcoming</p></article>
    <article class="board-metric"><p class="label">Direction</p><p class="value" style="font-size:1.2rem">${esc(dir)}</p><p class="note">Goals avg ${dash.charts.goalAvgProgress}%</p></article>
  </div>`;
}

function roomHead(_code: string, title: string, lore: string) {
  return `<header class="page-head">
      <h2 class="page-title" tabindex="-1">${esc(title)}</h2>
      <p class="page-sub">${lore}</p>
      <p class="msg" data-room-msg role="status"></p>
    </header>`;
}

function cashChart(series: Dashboard["charts"]["cashSeries"]) {
  if (!series.length) return `<p class="empty">No cash trend yet. Add an entry in Money.</p>`;
  const vals = series.map((s) => s.balance);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 1);
  const span = Math.max(1, max - min);
  const pts = series
    .map((s, i) => {
      const x = (i / Math.max(1, series.length - 1)) * 100;
      const y = 100 - ((s.balance - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const label = `Cash from ${series[0].label} to ${series[series.length - 1].label}`;
  return `<svg class="cash-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">
    <title>${esc(label)}</title>
    <polyline fill="none" stroke="#1f6b4a" stroke-width="2" vector-effect="non-scaling-stroke" points="${pts}" />
  </svg>`;
}

function directionMap(dash: Dashboard) {
  const dir = dash.charts.direction;
  const marker = dir === "forward" ? 82 : dir === "steady" ? 50 : 18;
  const word = dir === "forward" ? "forward" : dir === "steady" ? "steady" : "stalled";
  return `<div class="dir-map">
    <div class="dir-path" aria-hidden="true"></div>
    <div class="dir-node" style="left:${marker}%"></div>
    <div class="dir-labels"><span>Stalled</span><span>Steady</span><span>Forward</span></div>
    <p class="dir-readout">Direction is ${esc(word)}. Projects average ${dash.charts.projectAvgProgress}%. Goals average ${dash.charts.goalAvgProgress}%.</p>
  </div>`;
}

async function loadDash(root: HTMLElement): Promise<Dashboard | null> {
  try {
    return await getDashboard();
  } catch (err) {
    const msg =
      err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "The board could not be opened.";
    root.innerHTML = `${roomHead("", "Could not open", "")}<p class="msg bad" role="alert">${esc(msg)}</p>`;
    return null;
  }
}

export async function renderHome(root: HTMLElement) {
  root.innerHTML = `${roomHead("", "Today", "Loading your day…")}`;
  const dash = await loadDash(root);
  if (!dash) return;
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const openTasks = dash.activitiesToday.filter((a) => !a.done).length;
  const doneTasks = dash.activitiesToday.filter((a) => a.done).length;
  const nextCall = dash.meetingsUpcoming[0];
  const nextReminder = dash.reminders[0];
  const topProjects = [...dash.projects].sort((a, b) => b.progress - a.progress).slice(0, 5);
  const topGoals = [...dash.goals].sort((a, b) => b.progress - a.progress).slice(0, 4);
  const dayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  root.innerHTML = `
    ${roomHead("", "Today", `${hello}. One board for tasks, calls, money, and project momentum.`)}
    <div class="board">
      <div class="day-banner">
        <div>
          <h3>${esc(dayLabel)}</h3>
          <p>${
            nextCall
              ? `Next call: ${esc(nextCall.title)} · ${esc(new Date(nextCall.startsAt).toLocaleString())}`
              : "No calls booked yet — add one in Schedule when you need it."
          }</p>
        </div>
        <div class="day-banner-meta">
          <span class="chip">Tasks <strong>${openTasks}</strong> open</span>
          <span class="chip">Done <strong>${doneTasks}</strong></span>
          <span class="chip">Calls <strong>${dash.meetingsUpcoming.length}</strong></span>
          <span class="chip">Cash <strong>${money(dash.finance.balanceCents)}</strong></span>
        </div>
      </div>

      ${productivityStrip(dash)}

      <div class="three-col">
        <section class="panel-card">
          <div class="board-section-head">
            <h3>Daily tasks</h3>
            <p>${openTasks} still open</p>
          </div>
          <ul class="jobs" id="homeActs">
            ${
              dash.activitiesToday.length
                ? dash.activitiesToday
                    .map(
                      (a) =>
                        `<li class="entry"><div class="entry-copy"><p class="entry-title">${a.done ? "✓ " : ""}${esc(a.title)}</p></div>
                        <div class="acts"><button type="button" class="ghost" data-act="${esc(a.id)}">${a.done ? "Undo" : "Done"}</button></div></li>`,
                    )
                    .join("")
                : `<li class="entry is-empty"><p class="entry-title">No tasks yet — add one below.</p></li>`
            }
          </ul>
          <form class="inline-form" id="homeActForm">
            <label class="field"><span>New task</span><input id="homeActTitle" maxlength="160" autocomplete="off" placeholder="Call supplier, ship draft…" /></label>
            <button type="submit" class="primary">Add</button>
          </form>
        </section>

        <section class="panel-card">
          <div class="board-section-head">
            <h3>Calls & meetings</h3>
            <p>Upcoming</p>
          </div>
          <ul class="jobs">
            ${
              dash.meetingsUpcoming.length
                ? dash.meetingsUpcoming
                    .slice(0, 6)
                    .map(
                      (m) =>
                        `<li class="entry"><div class="entry-copy"><p class="entry-title">${esc(m.title)}</p><p class="entry-meta">${esc(new Date(m.startsAt).toLocaleString())}${m.place ? ` · ${esc(m.place)}` : ""}</p></div></li>`,
                    )
                    .join("")
                : `<li class="entry is-empty"><p class="entry-title">Nothing booked. Add calls in Schedule.</p></li>`
            }
          </ul>
          <ul class="detail-list">
            <li><span>Next call</span><b>${nextCall ? esc(new Date(nextCall.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })) : "—"}</b></li>
            <li><span>Reminders</span><b>${dash.reminders.length}</b></li>
          </ul>
        </section>

        <section class="panel-card">
          <div class="board-section-head">
            <h3>Reminders</h3>
            <p>Due soon</p>
          </div>
          <ul class="jobs">
            ${
              dash.reminders.length
                ? dash.reminders
                    .slice(0, 6)
                    .map(
                      (r) =>
                        `<li class="entry"><div class="entry-copy"><p class="entry-title">${esc(r.title)}</p><p class="entry-meta">${esc(r.priority)} · ${esc(new Date(r.dueAt).toLocaleString())}</p></div></li>`,
                    )
                    .join("")
                : `<li class="entry is-empty"><p class="entry-title">${nextReminder ? "" : "No open reminders."}</p></li>`
            }
          </ul>
          <ul class="detail-list">
            <li><span>Income</span><b>${money(dash.finance.incomeCents)}</b></li>
            <li><span>Spent</span><b>${money(dash.finance.expenseCents)}</b></li>
            <li><span>Balance</span><b>${money(dash.finance.balanceCents)}</b></li>
          </ul>
        </section>
      </div>

      <div class="two-col">
        <section class="panel-card">
          <div class="board-section-head">
            <h3>Project productivity</h3>
            <p>${dash.projects.length} active · avg ${dash.charts.projectAvgProgress}%</p>
          </div>
          ${
            topProjects.length
              ? topProjects.map((p) => meter(p.title, p.progress, p.realm)).join("")
              : `<p class="empty">Create projects in Work to track productivity here.</p>`
          }
          <div style="margin-top:0.85rem">${directionMap(dash)}</div>
        </section>

        <section class="panel-card">
          <div class="board-section-head">
            <h3>Goals & focus</h3>
            <p>Avg ${dash.charts.goalAvgProgress}%</p>
          </div>
          ${
            topGoals.length
              ? topGoals.map((g) => meter(g.title, g.progress, g.realm)).join("")
              : `<p class="empty">Add goals in Work so they show up here.</p>`
          }
          <ul class="detail-list">
            <li><span>Work projects</span><b>${dash.projects.filter((p) => p.realm === "work").length}</b></li>
            <li><span>Personal projects</span><b>${dash.projects.filter((p) => p.realm === "personal").length}</b></li>
            <li><span>Urgent plans</span><b>${dash.emergencies.filter((e) => e.active).length}</b></li>
          </ul>
        </section>
      </div>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void guard(root, async () => {
        await toggleActivity(btn.dataset.act!);
        await renderHome(root);
      });
    });
  });

  root.querySelector("#homeActForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = (root.querySelector("#homeActTitle") as HTMLInputElement).value.trim();
    if (!title) return say(root, "Name the task first.", "bad");
    void guard(root, async () => {
      await createActivity({ title });
      await renderHome(root);
    });
  });
}

export async function renderForge(root: HTMLElement) {
  root.innerHTML = `${roomHead("", "Work", "Loading projects…")}`;
  const dash = await loadDash(root);
  if (!dash) return;

  let ghBlock = `<div class="board-section-head">
      <h3>Connect GitHub</h3>
      <p>Public username — RAGI measures production, pace, time, and errors</p>
    </div>
    <p class="quiet">Enter your GitHub username (example: Arnold-RG). RAGI reads public repos, push cadence, and issue pressure.</p>
    <form class="inline-form" id="ghLoginForm">
      <label class="field"><span>GitHub username</span><input id="ghLogin" maxlength="39" autocomplete="off" spellcheck="false" placeholder="Arnold-RG" /></label>
      <button type="submit" class="primary">Connect</button>
    </form>`;
  let ghIntelStrip = "";
  try {
    const gh = await listGithubRepos();
    if (!gh.needsLogin && gh.login) {
      const intel = gh.intel;
      if (intel) {
        ghIntelStrip = `
          <section class="panel-card" style="margin-bottom:0.25rem">
            <div class="board-section-head">
              <h3>GitHub performance — @${esc(intel.login)}</h3>
              <p>Updated ${esc(new Date(intel.fetchedAt).toLocaleString())}</p>
            </div>
            <div class="board-strip">
              <article class="board-metric"><p class="label">Production</p><p class="value">${intel.productionPercent}%</p><p class="note">Completion signal</p></article>
              <article class="board-metric"><p class="label">Performance</p><p class="value">${intel.performanceScore}</p><p class="note">Pace / 100</p></article>
              <article class="board-metric"><p class="label">Time mgmt</p><p class="value">${intel.timeManagementScore}</p><p class="note">Consistency / 100</p></article>
              <article class="board-metric"><p class="label">Error pressure</p><p class="value">${intel.errorRatePercent}%</p><p class="note">Open-issue load</p></article>
            </div>
            <ul class="detail-list">
              <li><span>Repos</span><b>${intel.stats.repoCount}</b></li>
              <li><span>Active (7d)</span><b>${intel.stats.activeRepos7d}</b></li>
              <li><span>Stale (30d+)</span><b>${intel.stats.staleRepos30d}</b></li>
              <li><span>Commits ~14d</span><b>${intel.stats.commitsApprox14d}</b></li>
              <li><span>Issues sample</span><b>${intel.stats.openIssuesSample} open / ${intel.stats.closedIssuesSample} closed</b></li>
            </ul>
            <ul class="feedback-list">
              ${intel.feedback.map((f) => `<li>${esc(f)}</li>`).join("")}
            </ul>
          </section>`;
      }
      ghBlock = `
        ${ghIntelStrip}
        <div class="board-section-head">
          <h3>GitHub repositories</h3>
          <p>@${esc(gh.login)} · avg ${gh.avgProgress}% done · ${gh.count} repos</p>
        </div>
        <form class="inline-form" id="ghLoginForm">
          <label class="field"><span>GitHub username</span><input id="ghLogin" value="${esc(gh.login)}" maxlength="39" autocomplete="off" spellcheck="false" /></label>
          <button type="submit" class="ghost">Refresh</button>
        </form>
        <ul class="jobs gh-list" style="margin-top:0.75rem">
          ${
            gh.projects.length
              ? gh.projects
                  .slice(0, 12)
                  .map(
                    (p) => `<li class="gh-row">
                      <div class="gh-head">
                        <a href="${esc(p.url)}" target="_blank" rel="noreferrer">${esc(p.name)}</a>
                        <span>${p.progress}% done · ${p.remaining}% left${p.daysSincePush != null ? ` · ${p.daysSincePush}d` : ""}</span>
                      </div>
                      ${meter(p.name, p.progress)}
                      <p class="gh-meta">${esc(p.language || "No language")}${p.openIssues != null ? ` · ${p.openIssues} open issues` : ""} · ${esc((p.description || "").slice(0, 100))}</p>
                      <form class="inline-form" data-ghprog="${esc(p.fullName)}">
                        <label class="field"><span>Set % done</span><input type="number" min="0" max="100" value="${p.progress}" /></label>
                        <button type="submit" class="ghost">Save</button>
                      </form>
                    </li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">No public repositories found.</p></li>`
          }
        </ul>`;
    }
  } catch (err) {
    ghBlock = `<p class="msg bad">${esc(err instanceof Error ? err.message : "GitHub is unreachable.")}</p>
      <form class="inline-form" id="ghLoginForm">
        <label class="field"><span>GitHub username</span><input id="ghLogin" maxlength="39" autocomplete="off" spellcheck="false" placeholder="Arnold-RG" /></label>
        <button type="submit" class="primary">Retry</button>
      </form>`;
  }

  root.innerHTML = `
    ${roomHead("", "Work", "Personal projects, GitHub production analytics, tasks, and goals — your operating desk.")}
    <div class="board">
      ${productivityStrip(dash)}
      <section class="board-section">
        <div class="board-section-head">
          <h3>Productivity dashboard</h3>
          <p>Project speed by realm</p>
        </div>
        ${
          dash.charts.speedBars.length
            ? dash.charts.speedBars.map((b) => meter(b.label, b.value, b.realm)).join("")
            : `<p class="empty">Add projects to see productivity bars.</p>`
        }
        <div style="margin-top:0.85rem">${directionMap(dash)}</div>
      </section>

      <div class="two-col">
        <section class="board-section">
          <div class="board-section-head">
            <h3>Personal & work projects</h3>
            <p>${dash.projects.length} active</p>
          </div>
          <ul class="jobs" id="projList">
            ${
              dash.projects.length
                ? dash.projects
                    .map(
                      (p) =>
                        `<li class="entry" data-id="${esc(p.id)}"><div class="entry-copy"><p class="entry-title">${esc(p.title)}</p><p class="entry-meta">${esc(p.realm)} · ${p.progress}%</p>${p.notes ? `<p class="entry-note">${esc(p.notes)}</p>` : ""}</div>
                        <div class="acts">
                          <button type="button" class="ghost" data-bump="${esc(p.id)}" data-p="${Math.min(100, p.progress + 10)}">+10%</button>
                          <button type="button" class="ghost" data-pedit="${esc(p.id)}">Edit</button>
                          <button type="button" class="ghost" data-pdel="${esc(p.id)}">Archive</button>
                        </div></li>`,
                    )
                    .join("")
                : `<li class="entry is-empty"><p class="entry-title">No projects yet.</p></li>`
            }
          </ul>
          <form class="stack" id="projForm" style="margin-top:0.85rem">
            <label class="field"><span>Project title</span><input id="projTitle" maxlength="160" autocomplete="off" /></label>
            <label class="field"><span>Notes</span><input id="projNotes" maxlength="2000" autocomplete="off" /></label>
            <label class="field"><span>Type</span><select id="projRealm"><option value="personal">Personal</option><option value="work">Work</option></select></label>
            <label class="field"><span>Progress %</span><input id="projProgress" type="number" min="0" max="100" value="0" inputmode="numeric" /></label>
            <button type="submit" class="primary">Add project</button>
          </form>
        </section>

        <section class="board-section">
          <div class="board-section-head">
            <h3>Goals</h3>
            <p>Targets that guide the week</p>
          </div>
          <ul class="jobs" id="goalList">
            ${
              dash.goals.length
                ? dash.goals
                    .map(
                      (g) =>
                        `<li class="entry"><div class="entry-copy"><p class="entry-title">${esc(g.title)}</p><p class="entry-meta">${g.progress}%${g.target ? ` · ${esc(g.target)}` : ""}</p></div>
                        <div class="acts">
                          <button type="button" class="ghost" data-gedit="${esc(g.id)}">Edit</button>
                          <button type="button" class="ghost" data-gdel="${esc(g.id)}">Archive</button>
                        </div></li>`,
                    )
                    .join("")
                : `<li class="entry is-empty"><p class="entry-title">No goals yet.</p></li>`
            }
          </ul>
          <form class="stack" id="goalForm" style="margin-top:0.85rem">
            <label class="field"><span>Goal</span><input id="goalTitle" maxlength="160" autocomplete="off" /></label>
            <label class="field"><span>Target</span><input id="goalTarget" maxlength="240" autocomplete="off" /></label>
            <label class="field"><span>Type</span><select id="goalRealm"><option value="personal">Personal</option><option value="work">Work</option></select></label>
            <button type="submit" class="primary">Add goal</button>
          </form>
        </section>
      </div>

      <section class="board-section">
        <div class="board-section-head">
          <h3>Daily tasks</h3>
          <p>What you will finish today</p>
        </div>
        <ul class="jobs">
          ${
            dash.activitiesToday.length
              ? dash.activitiesToday
                  .map(
                    (a) =>
                      `<li class="entry"><div class="entry-copy"><p class="entry-title">${a.done ? "✓ " : ""}${esc(a.title)}</p></div>
                      <div class="acts">
                        <button type="button" class="ghost" data-act="${esc(a.id)}">${a.done ? "Undo" : "Done"}</button>
                        <button type="button" class="ghost" data-adel="${esc(a.id)}">Archive</button>
                      </div></li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">No tasks yet.</p></li>`
          }
        </ul>
        <form class="inline-form" id="actForm">
          <label class="field"><span>Task</span><input id="actTitle" maxlength="160" autocomplete="off" /></label>
          <button type="submit" class="primary">Add</button>
        </form>
      </section>

      <section class="board-section">
        ${ghBlock}
      </section>
    </div>
  `;

  const projects = new Map(dash.projects.map((p) => [p.id, p]));
  const goals = new Map(dash.goals.map((g) => [g.id, g]));

  root.querySelector("#projForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = (root.querySelector("#projTitle") as HTMLInputElement).value.trim();
    if (!title) return say(root, "Add a title first.", "bad");
    void guard(root, async () => {
      await createProject({
        title,
        notes: (root.querySelector("#projNotes") as HTMLInputElement).value.trim() || undefined,
        realm: (root.querySelector("#projRealm") as HTMLSelectElement).value as "work" | "personal",
        progress: Number((root.querySelector("#projProgress") as HTMLInputElement).value) || 0,
      });
      await renderForge(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-bump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void guard(root, async () => {
        await patchProject(btn.dataset.bump!, { progress: Number(btn.dataset.p) });
        await renderForge(root);
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-pedit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const project = projects.get(btn.dataset.pedit!);
      const li = btn.closest("li");
      if (!project || !li) return;
      openRowEditor(
        li,
        [
          { name: "title", label: "Title", value: project.title },
          { name: "notes", label: "Notes", value: project.notes, multiline: true },
          { name: "progress", label: "Progress", value: String(project.progress), type: "number", min: "0", max: "100" },
        ],
        async (values) => {
          await patchProject(project.id, {
            title: values.title || undefined,
            notes: values.notes,
            progress: Math.max(0, Math.min(100, Math.round(Number(values.progress) || 0))),
          });
          await renderForge(root);
        },
        () => void renderForge(root),
      );
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-pdel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!window.confirm("Archive this project?")) return;
      void guard(root, async () => {
        await deleteProject(btn.dataset.pdel!);
        await renderForge(root);
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-gedit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const goal = goals.get(btn.dataset.gedit!);
      const li = btn.closest("li");
      if (!goal || !li) return;
      openRowEditor(
        li,
        [
          { name: "title", label: "Title", value: goal.title },
          { name: "target", label: "Target", value: goal.target },
          { name: "progress", label: "Progress", value: String(goal.progress), type: "number", min: "0", max: "100" },
        ],
        async (values) => {
          await patchGoal(goal.id, {
            title: values.title || undefined,
            target: values.target,
            progress: Math.max(0, Math.min(100, Math.round(Number(values.progress) || 0))),
          });
          await renderForge(root);
        },
        () => void renderForge(root),
      );
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-gdel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!window.confirm("Archive this goal?")) return;
      void guard(root, async () => {
        await deleteGoal(btn.dataset.gdel!);
        await renderForge(root);
      });
    });
  });

  root.querySelector("#goalForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = (root.querySelector("#goalTitle") as HTMLInputElement).value.trim();
    if (!title) return say(root, "Add a goal first.", "bad");
    void guard(root, async () => {
      await createGoal({
        title,
        target: (root.querySelector("#goalTarget") as HTMLInputElement).value.trim() || undefined,
        realm: (root.querySelector("#goalRealm") as HTMLSelectElement).value as "work" | "personal",
      });
      await renderForge(root);
    });
  });

  root.querySelector("#actForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = (root.querySelector("#actTitle") as HTMLInputElement).value.trim();
    if (!title) return say(root, "Name the activity first.", "bad");
    void guard(root, async () => {
      await createActivity({ title });
      await renderForge(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void guard(root, async () => {
        await toggleActivity(btn.dataset.act!);
        await renderForge(root);
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-adel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!window.confirm("Archive this activity?")) return;
      void guard(root, async () => {
        await deleteActivity(btn.dataset.adel!);
        await renderForge(root);
      });
    });
  });

  root.querySelector("#ghLoginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const login = (root.querySelector("#ghLogin") as HTMLInputElement).value.trim();
    if (!login) return say(root, "Enter a GitHub username.", "bad");
    void guard(root, async () => {
      await setGithubLogin(login);
      await renderForge(root);
    });
  });

  root.querySelectorAll<HTMLFormElement>("[data-ghprog]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const fullName = form.dataset.ghprog!;
      const progress = Number((form.querySelector("input") as HTMLInputElement).value);
      void guard(root, async () => {
        await setGithubProgress(fullName, Math.max(0, Math.min(100, Math.round(progress) || 0)));
        await renderForge(root);
      });
    });
  });
}

export async function renderGold(root: HTMLElement) {
  root.innerHTML = `${roomHead("", "Money", "Loading money…")}`;
  const dash = await loadDash(root);
  if (!dash) return;
  const f = dash.finance;

  root.innerHTML = `
    ${roomHead("", "Money", "Track income, spending, and what you have left.")}
    <div class="board">
      <div class="board-strip">
        <article class="board-metric"><p class="label">Income</p><p class="value">${money(f.incomeCents)}</p><p class="note">Recorded in</p></article>
        <article class="board-metric"><p class="label">Spent</p><p class="value">${money(f.expenseCents)}</p><p class="note">Recorded out</p></article>
        <article class="board-metric"><p class="label">Balance</p><p class="value">${money(f.balanceCents)}</p><p class="note">What remains</p></article>
        <article class="board-metric"><p class="label">Entries</p><p class="value">${f.recent.length}</p><p class="note">Recent rows</p></article>
      </div>
    <div class="two-col">
      <section class="board-section" style="border-top:0;padding-top:0.5rem">
        <div class="board-section-head"><h3>Add entry</h3><p>Income or expense</p></div>
        <form class="stack" id="finForm">
          <label class="field"><span>Type</span><select id="finKind"><option value="income">Income</option><option value="expense">Expense</option><option value="budget">Budget</option></select></label>
          <label class="field"><span>Amount</span><input id="finAmount" type="number" step="0.01" min="0" inputmode="decimal" /></label>
          <label class="field"><span>Label</span><input id="finLabel" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Category</span><input id="finCat" maxlength="80" autocomplete="off" /></label>
          <button type="submit" class="primary">Save entry</button>
        </form>
      </section>
      <section class="board-section" style="border-top:0;padding-top:0.5rem">
        <div class="board-section-head"><h3>Recent</h3><p>Latest money moves</p></div>
        <ul class="jobs">
          ${
            f.recent.length
              ? f.recent
                  .map(
                    (e) =>
                      `<li class="entry"><div class="entry-copy"><p class="entry-title">${esc(e.label)}</p><p class="entry-meta">${esc(e.kind)} · ${money(e.amountCents)}</p></div>
                      <div class="acts">
                        <button type="button" class="ghost" data-fedit="${esc(e.id)}">Edit</button>
                        <button type="button" class="ghost" data-fdel="${esc(e.id)}">Archive</button>
                      </div></li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">No entries yet.</p></li>`
          }
        </ul>
      </section>
    </div>
    <section class="board-section">
      <div class="board-section-head"><h3>Cash trend</h3><p>Balance over recent entries</p></div>
      <div class="cash-wrap tall">${cashChart(dash.charts.cashSeries)}</div>
    </section>
    </div>
  `;

  const recent = new Map(f.recent.map((e) => [e.id, e]));

  root.querySelectorAll<HTMLButtonElement>("[data-fedit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const entry = recent.get(btn.dataset.fedit!);
      const li = btn.closest("li");
      if (!entry || !li) return;
      openRowEditor(
        li,
        [
          { name: "label", label: "Label", value: entry.label },
          { name: "amount", label: "Amount", value: (entry.amountCents / 100).toFixed(2), type: "number" },
        ],
        async (values) => {
          const amount = Number(values.amount);
          if (!values.label || !(amount > 0)) throw new ApiError(400, { message: "Add a label and an amount." });
          await patchFinance(entry.id, { label: values.label, amount });
          await renderGold(root);
        },
        () => void renderGold(root),
      );
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-fdel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!window.confirm("Archive this entry?")) return;
      void guard(root, async () => {
        await deleteFinance(btn.dataset.fdel!);
        await renderGold(root);
      });
    });
  });

  root.querySelector("#finForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number((root.querySelector("#finAmount") as HTMLInputElement).value);
    const label = (root.querySelector("#finLabel") as HTMLInputElement).value.trim();
    if (!label || !(amount > 0)) return say(root, "Add a label and an amount greater than zero.", "bad");
    void guard(root, async () => {
      await createFinance({
        kind: (root.querySelector("#finKind") as HTMLSelectElement).value as "income" | "expense" | "budget",
        amount,
        label,
        category: (root.querySelector("#finCat") as HTMLInputElement).value.trim() || undefined,
      });
      await renderGold(root);
    });
  });
}

export async function renderClock(root: HTMLElement) {
  root.innerHTML = `${roomHead("", "Schedule", "Loading schedule…")}`;
  const dash = await loadDash(root);
  if (!dash) return;

  root.innerHTML = `
    ${roomHead("", "Schedule", "Manage calls, meetings, and reminders in one place.")}
    <div class="board">
      <div class="board-strip">
        <article class="board-metric"><p class="label">Upcoming calls</p><p class="value">${dash.meetingsUpcoming.length}</p><p class="note">Meetings booked</p></article>
        <article class="board-metric"><p class="label">Reminders</p><p class="value">${dash.reminders.length}</p><p class="note">Open items</p></article>
        <article class="board-metric"><p class="label">Urgent plans</p><p class="value">${dash.emergencies.filter((e) => e.active).length}</p><p class="note">Needs attention</p></article>
        <article class="board-metric"><p class="label">Tasks today</p><p class="value">${dash.activitiesToday.filter((a) => !a.done).length}</p><p class="note">Still open</p></article>
      </div>
    <div class="dash-grid">
      <section class="stat-box">
        <h3>Calls & meetings</h3>
        <ul class="jobs">
          ${
            dash.meetingsUpcoming.length
              ? dash.meetingsUpcoming
                  .map(
                    (m) =>
                      `<li class="entry"><div class="entry-copy"><p class="entry-title">${esc(m.title)}</p><p class="entry-meta">${m.place ? `${esc(m.place)} · ` : ""}${esc(new Date(m.startsAt).toLocaleString())}</p></div>
                      <div class="acts"><button type="button" class="ghost" data-mdel="${esc(m.id)}">Archive</button></div></li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">Nothing upcoming.</p></li>`
          }
        </ul>
        <form class="stack" id="meetForm">
          <label class="field"><span>Title</span><input id="meetTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Place or link</span><input id="meetPlace" maxlength="240" autocomplete="off" /></label>
          <label class="field"><span>Starts</span><input id="meetStart" type="datetime-local" /></label>
          <label class="field"><span>Ends</span><input id="meetEnd" type="datetime-local" /></label>
          <button type="submit" class="primary">Schedule</button>
        </form>
      </section>
      <section class="stat-box">
        <h3>Reminders</h3>
        <ul class="jobs">
          ${
            dash.reminders.length
              ? dash.reminders
                  .map(
                    (r) =>
                      `<li class="entry"><div class="entry-copy"><p class="entry-title">${esc(r.title)}</p><p class="entry-meta">${esc(r.priority)} · ${esc(new Date(r.dueAt).toLocaleString())}</p></div>
                      <div class="acts">
                        <button type="button" class="ghost" data-rem="${esc(r.id)}">Done</button>
                        <button type="button" class="ghost" data-rdel="${esc(r.id)}">Archive</button>
                      </div></li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">The board is clear.</p></li>`
          }
        </ul>
        <form class="stack" id="remForm">
          <label class="field"><span>Reminder</span><input id="remTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Due</span><input id="remDue" type="datetime-local" /></label>
          <label class="field"><span>Priority</span><select id="remPri"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label>
          <button type="submit" class="primary">Set reminder</button>
        </form>
      </section>
      <section class="stat-box wide">
        <h3>Emergencies</h3>
        <ul class="jobs">
          ${
            dash.emergencies.length
              ? dash.emergencies
                  .map(
                    (e) =>
                      `<li class="entry"><div class="entry-copy"><p class="entry-title">${e.active ? "Live · " : "Resolved · "}${esc(e.severity)} · ${esc(e.title)}</p><p class="entry-note">${esc(e.body)}</p></div>
                      <div class="acts">
                        ${e.active ? `<button type="button" class="ghost" data-em="${esc(e.id)}">Resolve</button>` : ""}
                        <button type="button" class="ghost" data-edel="${esc(e.id)}">Archive</button>
                      </div></li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">No emergency plans.</p></li>`
          }
        </ul>
        <form class="stack" id="emForm">
          <label class="field"><span>Title</span><input id="emTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Protocol</span><input id="emBody" maxlength="2000" autocomplete="off" /></label>
          <label class="field"><span>Severity</span><select id="emSev"><option value="high">High</option><option value="critical">Critical</option><option value="low">Low</option></select></label>
          <button type="submit" class="primary">Save plan</button>
        </form>
      </section>
    </div>
    </div>
  `;

  const archive = (attr: string, run: (id: string) => Promise<unknown>, ask: string) => {
    root.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!window.confirm(ask)) return;
        void guard(root, async () => {
          await run(btn.dataset[attr.slice(5)]!);
          await renderClock(root);
        });
      });
    });
  };
  archive("data-mdel", deleteMeeting, "Archive this meeting?");
  archive("data-rdel", deleteReminder, "Archive this reminder?");
  archive("data-edel", deleteEmergency, "Archive this plan?");

  root.querySelector("#meetForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = (root.querySelector("#meetTitle") as HTMLInputElement).value.trim();
    const startsAt = (root.querySelector("#meetStart") as HTMLInputElement).value;
    const endsAt = (root.querySelector("#meetEnd") as HTMLInputElement).value;
    if (!title || !startsAt || !endsAt) return say(root, "Add a title, a start, and an end.", "bad");
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return say(root, "The meeting should end after it starts.", "bad");
    }
    void guard(root, async () => {
      await createMeeting({
        title,
        place: (root.querySelector("#meetPlace") as HTMLInputElement).value.trim() || undefined,
        startsAt: localIsoFromInput(startsAt),
        endsAt: localIsoFromInput(endsAt),
      });
      await renderClock(root);
    });
  });

  root.querySelector("#remForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = (root.querySelector("#remTitle") as HTMLInputElement).value.trim();
    const dueAt = (root.querySelector("#remDue") as HTMLInputElement).value;
    if (!title || !dueAt) return say(root, "Add a reminder and a time.", "bad");
    void guard(root, async () => {
      await createReminder({
        title,
        dueAt: localIsoFromInput(dueAt),
        priority: (root.querySelector("#remPri") as HTMLSelectElement).value as "low" | "normal" | "high",
      });
      await renderClock(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-rem]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void guard(root, async () => {
        await completeReminder(btn.dataset.rem!);
        await renderClock(root);
      });
    });
  });

  root.querySelector("#emForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = (root.querySelector("#emTitle") as HTMLInputElement).value.trim();
    if (!title) return say(root, "Name the plan first.", "bad");
    void guard(root, async () => {
      await createEmergency({
        title,
        body: (root.querySelector("#emBody") as HTMLInputElement).value.trim(),
        severity: (root.querySelector("#emSev") as HTMLSelectElement).value as "low" | "high" | "critical",
      });
      await renderClock(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-em]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void guard(root, async () => {
        await resolveEmergency(btn.dataset.em!);
        await renderClock(root);
      });
    });
  });
}

export async function renderHub(root: HTMLElement) {
  root.innerHTML = `${roomHead("", "GitHub", "Loading repositories…")}`;
  try {
    const data = await listGithubRepos();
    if (data.needsLogin || !data.login) {
      root.innerHTML = `
        ${roomHead("", "GitHub", "Track public repo progress for your account only.")}
        <form class="stack narrow" id="ghLoginForm">
          <label class="field"><span>GitHub username</span><input id="ghLogin" maxlength="39" autocomplete="off" spellcheck="false" /></label>
          <button type="submit" class="primary">Save</button>
        </form>
      `;
      root.querySelector("#ghLoginForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const login = (root.querySelector("#ghLogin") as HTMLInputElement).value.trim();
        if (!login) return say(root, "Enter a GitHub username.", "bad");
        void guard(root, async () => {
          await setGithubLogin(login);
          await renderHub(root);
        });
      });
      return;
    }

    root.innerHTML = `
      ${roomHead(
        "",
        "GitHub",
        `${data.count} public repos for ${esc(data.login)}. Average done ${data.avgProgress}%, remaining ${data.avgRemaining}%.`,
      )}
      <form class="inline-form" id="ghLoginForm">
        <label class="field"><span>GitHub username</span><input id="ghLogin" value="${esc(data.login)}" maxlength="39" autocomplete="off" spellcheck="false" /></label>
        <button type="submit" class="ghost">Update</button>
      </form>
      <ul class="jobs gh-list">
        ${
          data.projects.length
            ? data.projects
                .map(
                  (p) => `<li class="gh-row">
                    <div class="gh-head">
                      <a href="${esc(p.url)}" target="_blank" rel="noreferrer">${esc(p.name)}<span class="sr-only"> (opens in a new tab)</span></a>
                      <span>${p.progress}% done · ${p.remaining}% left · ${p.overridden ? "set" : "estimated"}</span>
                    </div>
                    ${meter(p.name, p.progress)}
                    <p class="gh-meta">${esc(p.language || "No language")} · ${esc((p.description || "No description").slice(0, 120))}</p>
                    <div class="acts">
                      <button type="button" class="ghost" data-gh="${esc(p.fullName)}" data-p="${p.progress}">Set percent</button>
                    </div>
                  </li>`,
                )
                .join("")
            : `<li class="entry is-empty"><p class="entry-title">No public repositories under that name.</p></li>`
        }
      </ul>
      <p class="hint">Estimated percent comes from public signals. A number you set is stored only on your account.</p>
    `;

    root.querySelector("#ghLoginForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const login = (root.querySelector("#ghLogin") as HTMLInputElement).value.trim();
      if (!login) return say(root, "Enter a GitHub username.", "bad");
      void guard(root, async () => {
        await setGithubLogin(login);
        await renderHub(root);
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-gh]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const li = btn.closest(".gh-row");
        if (!li) return;
        openRowEditor(
          li as HTMLElement,
          [
            {
              name: "progress",
              label: `Completion for ${btn.dataset.gh}`,
              value: btn.dataset.p ?? "0",
              type: "number",
              min: "0",
              max: "100",
            },
          ],
          async (values) => {
            const n = Math.min(100, Math.max(0, Number(values.progress)));
            if (Number.isNaN(n)) throw new ApiError(400, { message: "Enter a number from 0 to 100." });
            await setGithubProgress(btn.dataset.gh!, n);
            await renderHub(root);
          },
          () => void renderHub(root),
        );
      });
    });
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : "GitHub did not answer.";
    root.innerHTML = `${roomHead("", "GitHub", "")}<p class="msg bad" role="alert">${esc(msg)}</p>
      <p class="hint">Connect a GitHub username to list public repositories.</p>`;
  }
}

export async function renderMap(root: HTMLElement) {
  root.innerHTML = `${roomHead("", "Progress", "Loading progress…")}`;
  const dash = await loadDash(root);
  if (!dash) return;

  root.innerHTML = `
    ${roomHead("", "Progress", "Progress, direction, and cash from your vault.")}
    <div class="dash-grid">
      <section class="stat-box wide">
        <h3>Direction</h3>
        ${directionMap(dash)}
      </section>
      <section class="stat-box">
        <h3>Project speed</h3>
        ${
          dash.charts.speedBars.length
            ? dash.charts.speedBars.map((b) => meter(b.label, b.value, b.realm)).join("")
            : `<p class="empty">Forge a project to fill this chart.</p>`
        }
      </section>
      <section class="stat-box">
        <h3>Goals</h3>
        ${
          dash.goals.length
            ? dash.goals
                .slice(0, 8)
                .map((g) => meter(g.title, g.progress, "amber"))
                .join("")
            : `<p class="empty">No goals yet.</p>`
        }
      </section>
      <section class="stat-box wide">
        <h3>Cash</h3>
        <div class="cash-wrap tall">${cashChart(dash.charts.cashSeries)}</div>
        <p class="hint">Balance ${money(dash.finance.balanceCents)} · in ${money(dash.finance.incomeCents)} · out ${money(dash.finance.expenseCents)}</p>
      </section>
    </div>
  `;
}
