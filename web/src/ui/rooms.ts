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

function roomHead(_code: string, title: string, lore: string) {
  return `<header class="page-head">
      <h2 class="page-title" tabindex="-1">${esc(title)}</h2>
      <p class="page-sub">${lore}</p>
      <p class="msg" data-room-msg role="status"></p>
    </header>`;
}

function cashChart(series: Dashboard["charts"]["cashSeries"]) {
  if (!series.length) return `<p class="empty">No cash trace yet. Post an entry in Gold.</p>`;
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
    <polyline fill="none" stroke="#c6a36a" stroke-width="2" vector-effect="non-scaling-stroke" points="${pts}" />
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
    const msg = err instanceof ApiError ? err.message : "The board could not be opened.";
    root.innerHTML = `${roomHead("", "Signal fault", "")}<p class="msg bad" role="alert">${esc(msg)}</p>`;
    return null;
  }
}

export async function renderHome(root: HTMLElement) {
  root.innerHTML = `${roomHead("", "Today", "Loading your day…")}`;
  const dash = await loadDash(root);
  if (!dash) return;
  const focus = dash.focusActive
    ? `${esc(dash.focusActive.label)} until ${esc(new Date(dash.focusActive.endsAt).toLocaleTimeString())}`
    : "None";
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  root.innerHTML = `
    ${roomHead("", "Today", `${hello}. Here’s a clear view of your day · mode: <strong>${esc(dash.mode)}</strong>`)}
    <div class="dash-grid">
      <section class="stat-box">
        <h3>At a glance</h3>
        <ul class="kpi">
          <li><span>Projects</span><b>${dash.projects.length}</b></li>
          <li><span>Goals</span><b>${dash.goals.length}</b></li>
          <li><span>Today</span><b>${dash.activitiesToday.filter((a) => a.done).length}/${dash.activitiesToday.length}</b></li>
          <li><span>Meetings</span><b>${dash.meetingsUpcoming.length}</b></li>
          <li><span>Reminders</span><b>${dash.reminders.length}</b></li>
          <li><span>Emergencies</span><b>${dash.emergencies.filter((e) => e.active).length}</b></li>
          <li><span>Quests</span><b>${dash.openJobs}</b></li>
          <li><span>Cash</span><b>${money(dash.finance.balanceCents)}</b></li>
          <li><span>Focus</span><b>${focus}</b></li>
        </ul>
      </section>
      <section class="stat-box">
        <h3>Speed</h3>
        ${
          dash.charts.speedBars.length
            ? dash.charts.speedBars.map((b) => meter(b.label, b.value, b.realm)).join("")
            : `<p class="empty">Add projects in the Forge to draw the bars.</p>`
        }
      </section>
      <section class="stat-box wide">
        <h3>Direction</h3>
        ${directionMap(dash)}
      </section>
      <section class="stat-box">
        <h3>Today</h3>
        <ul class="jobs" id="homeActs">
          ${
            dash.activitiesToday.length
              ? dash.activitiesToday
                  .map(
                    (a) =>
                      `<li class="entry"><div class="entry-copy"><p class="entry-title">${a.done ? "Done · " : ""}${esc(a.title)}</p></div>
                      <div class="acts"><button type="button" class="ghost" data-act="${esc(a.id)}">${a.done ? "Undo" : "Done"}</button></div></li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">Nothing planned for today.</p></li>`
          }
        </ul>
      </section>
      <section class="stat-box">
        <h3>Next meetings</h3>
        <ul class="jobs">
          ${
            dash.meetingsUpcoming.length
              ? dash.meetingsUpcoming
                  .slice(0, 5)
                  .map(
                    (m) =>
                      `<li class="entry"><div class="entry-copy"><p class="entry-title">${esc(m.title)}</p><p class="entry-meta">${esc(new Date(m.startsAt).toLocaleString())}</p></div></li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">The calendar is clear.</p></li>`
          }
        </ul>
      </section>
    </div>
    <p class="hint">Forge holds projects and goals. Gold is the ledger. Clock keeps meetings. Map draws the charts.</p>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void guard(root, async () => {
        await toggleActivity(btn.dataset.act!);
        await renderHome(root);
      });
    });
  });
}

export async function renderForge(root: HTMLElement) {
  root.innerHTML = `${roomHead("", "Work", "Loading projects…")}`;
  const dash = await loadDash(root);
  if (!dash) return;

  root.innerHTML = `
    ${roomHead("", "Work", "Projects, goals, and your day tasks.")}
    <div class="dash-grid">
      <section class="stat-box">
        <h3>Projects</h3>
        <ul class="jobs" id="projList">
          ${
            dash.projects.length
              ? dash.projects
                  .map(
                    (p) =>
                      `<li class="entry" data-id="${esc(p.id)}"><div class="entry-copy"><p class="entry-title">${esc(p.title)}</p><p class="entry-meta">${esc(p.realm)} · ${p.progress}%</p>${p.notes ? `<p class="entry-note">${esc(p.notes)}</p>` : ""}</div>
                      <div class="acts">
                        <button type="button" class="ghost" data-bump="${esc(p.id)}" data-p="${Math.min(100, p.progress + 10)}">+10</button>
                        <button type="button" class="ghost" data-pedit="${esc(p.id)}">Edit</button>
                        <button type="button" class="ghost" data-pdel="${esc(p.id)}">Archive</button>
                      </div></li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">No projects yet.</p></li>`
          }
        </ul>
        <form class="stack" id="projForm">
          <label class="field"><span>Title</span><input id="projTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Notes</span><input id="projNotes" maxlength="2000" autocomplete="off" /></label>
          <label class="field"><span>Realm</span><select id="projRealm"><option value="personal">Personal</option><option value="work">Work</option></select></label>
          <label class="field"><span>Progress</span><input id="projProgress" type="number" min="0" max="100" value="0" inputmode="numeric" /></label>
          <button type="submit" class="primary">Seal project</button>
        </form>
      </section>
      <section class="stat-box">
        <h3>Goals</h3>
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
        <form class="stack" id="goalForm">
          <label class="field"><span>Goal</span><input id="goalTitle" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Target</span><input id="goalTarget" maxlength="240" autocomplete="off" /></label>
          <label class="field"><span>Realm</span><select id="goalRealm"><option value="personal">Personal</option><option value="work">Work</option></select></label>
          <button type="submit" class="primary">Set goal</button>
        </form>
      </section>
      <section class="stat-box wide">
        <h3>Today</h3>
        <ul class="jobs">
          ${
            dash.activitiesToday.length
              ? dash.activitiesToday
                  .map(
                    (a) =>
                      `<li class="entry"><div class="entry-copy"><p class="entry-title">${a.done ? "Done · " : ""}${esc(a.title)}</p></div>
                      <div class="acts">
                        <button type="button" class="ghost" data-act="${esc(a.id)}">${a.done ? "Undo" : "Done"}</button>
                        <button type="button" class="ghost" data-adel="${esc(a.id)}">Archive</button>
                      </div></li>`,
                  )
                  .join("")
              : `<li class="entry is-empty"><p class="entry-title">The day is empty.</p></li>`
          }
        </ul>
        <form class="inline-form" id="actForm">
          <label class="field"><span>Activity</span><input id="actTitle" maxlength="160" autocomplete="off" /></label>
          <button type="submit" class="primary">Add</button>
        </form>
        <p class="hint">Archive seals a snapshot first. The row stays in vault memory.</p>
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
      if (!window.confirm("Archive this project? A snapshot is sealed first.")) return;
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
      if (!window.confirm("Archive this goal? A snapshot is sealed first.")) return;
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
}

export async function renderGold(root: HTMLElement) {
  root.innerHTML = `${roomHead("", "Money", "Loading money…")}`;
  const dash = await loadDash(root);
  if (!dash) return;
  const f = dash.finance;

  root.innerHTML = `
    ${roomHead("", "Money", "Income, spending, and what is left.")}
    <div class="dash-grid">
      <section class="stat-box">
        <h3>Balance</h3>
        <ul class="kpi">
          <li><span>Income</span><b>${money(f.incomeCents)}</b></li>
          <li><span>Expense</span><b>${money(f.expenseCents)}</b></li>
          <li><span>Balance</span><b>${money(f.balanceCents)}</b></li>
        </ul>
        <form class="stack" id="finForm">
          <label class="field"><span>Kind</span><select id="finKind"><option value="income">Income</option><option value="expense">Expense</option><option value="budget">Budget</option></select></label>
          <label class="field"><span>Amount</span><input id="finAmount" type="number" step="0.01" min="0" inputmode="decimal" /></label>
          <label class="field"><span>Label</span><input id="finLabel" maxlength="160" autocomplete="off" /></label>
          <label class="field"><span>Category</span><input id="finCat" maxlength="80" autocomplete="off" /></label>
          <button type="submit" class="primary">Post entry</button>
        </form>
      </section>
      <section class="stat-box">
        <h3>Recent</h3>
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
              : `<li class="entry is-empty"><p class="entry-title">The ledger is empty.</p></li>`
          }
        </ul>
      </section>
      <section class="stat-box wide">
        <h3>Cash trace</h3>
        <div class="cash-wrap">${cashChart(dash.charts.cashSeries)}</div>
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
      if (!window.confirm("Archive this entry? A snapshot is sealed first.")) return;
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
    ${roomHead("", "Schedule", "Meetings, reminders, and plans.")}
    <div class="dash-grid">
      <section class="stat-box">
        <h3>Meetings</h3>
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
          <button type="submit" class="primary">Arm plan</button>
        </form>
      </section>
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
