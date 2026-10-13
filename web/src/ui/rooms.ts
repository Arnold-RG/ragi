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
  patchGoal,
  patchProject,
  resolveEmergency,
  toggleActivity,
  type Dashboard,
} from "../api/life";
import { listGithubRepos, setGithubProgress } from "../api/github";
import { ApiError } from "../api/client";

function ask(label: string, fallback = "") {
  const v = window.prompt(label, fallback);
  return v === null ? null : v.trim();
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function barRow(label: string, value: number, tone = "") {
  return `<div class="bar-row ${tone}">
    <span class="bar-label">${esc(label)}</span>
    <div class="bar-track"><i style="width:${Math.min(100, Math.max(0, value))}%"></i></div>
    <span class="bar-val">${value}%</span>
  </div>`;
}

function cashChart(series: Dashboard["charts"]["cashSeries"]) {
  if (!series.length) {
    return `<div class="chart-empty">NO CASH TRACE YET · POST IN G-55 GOLD</div>`;
  }
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
  return `<svg class="cash-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polyline fill="none" stroke="#5cff7a" stroke-width="2" points="${pts}" />
  </svg>`;
}

function directionMap(dash: Dashboard) {
  const dir = dash.charts.direction;
  const marker =
    dir === "forward" ? 78 : dir === "steady" ? 48 : 18;
  return `<div class="dir-map" aria-label="Direction map">
    <div class="dir-path"></div>
    <div class="dir-node" style="left:${marker}%"></div>
    <div class="dir-labels"><span>STALL</span><span>STEADY</span><span>FORWARD</span></div>
    <p class="dir-readout">VECTOR :: ${dir.toUpperCase()} · AVG PROJECT ${dash.charts.projectAvgProgress}% · GOAL ${dash.charts.goalAvgProgress}%</p>
  </div>`;
}

async function loadDash(root: HTMLElement): Promise<Dashboard | null> {
  try {
    return await getDashboard();
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : "dashboard_failed";
    root.innerHTML = `<p class="prompt">&gt; SIGNAL FAULT</p><p class="msg bad">${esc(msg)}</p>`;
    return null;
  }
}

export async function renderHome(root: HTMLElement) {
  const dash = await loadDash(root);
  if (!dash) return;

  root.innerHTML = `
    <p class="prompt">&gt; H-01 HOME <span class="blink">_</span></p>
    <p class="lore">Owner hearth. Work and personal boards share one vault. Mode: <strong>${esc(dash.mode)}</strong>.</p>
    <div class="dash-grid">
      <div class="stat-box">
        <h3>BOARD</h3>
        <ul class="kpi">
          <li><span>Projects</span><b>${dash.projects.length}</b></li>
          <li><span>Goals</span><b>${dash.goals.length}</b></li>
          <li><span>Today</span><b>${dash.activitiesToday.filter((a) => a.done).length}/${dash.activitiesToday.length}</b></li>
          <li><span>Meetings</span><b>${dash.meetingsUpcoming.length}</b></li>
          <li><span>Reminders</span><b>${dash.reminders.length}</b></li>
          <li><span>Emergencies</span><b>${dash.emergencies.filter((e) => e.active).length}</b></li>
          <li><span>Quests</span><b>${dash.openJobs}</b></li>
          <li><span>Cash</span><b>${money(dash.finance.balanceCents)}</b></li>
        </ul>
      </div>
      <div class="stat-box">
        <h3>SPEED</h3>
        ${
          dash.charts.speedBars.length
            ? dash.charts.speedBars.map((b) => barRow(b.label, b.value, b.realm)).join("")
            : `<p class="hint">Add projects in F-33 FORGE to draw speed bars.</p>`
        }
      </div>
      <div class="stat-box wide">
        <h3>DIRECTION</h3>
        ${directionMap(dash)}
      </div>
      <div class="stat-box">
        <h3>TODAY</h3>
        <ul class="jobs" id="homeActs">
          ${
            dash.activitiesToday.length
              ? dash.activitiesToday
                  .map(
                    (a) =>
                      `<li><span>${a.done ? "✓ " : "· "}${esc(a.title)}</span><button type="button" data-act="${a.id}">TOGGLE</button></li>`,
                  )
                  .join("")
              : `<li><span>no daily activities</span><span>—</span></li>`
          }
        </ul>
      </div>
      <div class="stat-box">
        <h3>NEXT MEETINGS</h3>
        <ul class="jobs">
          ${
            dash.meetingsUpcoming.length
              ? dash.meetingsUpcoming
                  .slice(0, 5)
                  .map(
                    (m) =>
                      `<li><span>${esc(m.title)}</span><span>${new Date(m.startsAt).toLocaleString()}</span></li>`,
                  )
                  .join("")
              : `<li><span>calendar clear</span><span>—</span></li>`
          }
        </ul>
      </div>
    </div>
    <p class="hint">NAV · F-33 FORGE projects/goals · G-55 GOLD ledger · C-88 CLOCK meetings · M-99 MAP charts</p>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await toggleActivity(btn.dataset.act!);
      await renderHome(root);
    });
  });
}

export async function renderForge(root: HTMLElement) {
  const dash = await loadDash(root);
  if (!dash) return;

  root.innerHTML = `
    <p class="prompt">&gt; F-33 FORGE <span class="blink">_</span></p>
    <p class="lore">Plan projects, goals, and daily activities. Progress drives the MAP.</p>
    <div class="dash-grid">
      <div class="stat-box">
        <h3>PROJECTS</h3>
        <ul class="jobs" id="projList">
          ${
            dash.projects.length
              ? dash.projects
                  .map(
                    (p) =>
                      `<li class="row-actions"><span>${esc(p.title)} · ${p.realm} · ${p.progress}%</span>
                      <span class="acts">
                        <button type="button" data-bump="${p.id}" data-p="${Math.min(100, p.progress + 10)}">+10</button>
                        <button type="button" data-pedit="${p.id}" data-title="${esc(p.title)}" data-prog="${p.progress}">EDIT</button>
                        <button type="button" data-pdel="${p.id}">DEL</button>
                      </span></li>`,
                  )
                  .join("")
              : `<li><span>no projects</span><span>—</span></li>`
          }
        </ul>
        <div class="job-form">
          <input id="projTitle" placeholder="project title" />
          <input id="projNotes" placeholder="notes / plan" />
          <select id="projRealm"><option value="personal">personal / home</option><option value="work">work</option></select>
          <input id="projProgress" type="number" min="0" max="100" value="0" placeholder="%" />
          <button type="button" id="projAdd">SEAL PROJECT</button>
        </div>
      </div>
      <div class="stat-box">
        <h3>GOALS</h3>
        <ul class="jobs">
          ${
            dash.goals.length
              ? dash.goals
                  .map(
                    (g) =>
                      `<li class="row-actions"><span>${esc(g.title)} · ${g.progress}%</span>
                      <span class="acts">
                        <button type="button" data-gedit="${g.id}" data-title="${esc(g.title)}" data-prog="${g.progress}">EDIT</button>
                        <button type="button" data-gdel="${g.id}">DEL</button>
                      </span></li>`,
                  )
                  .join("")
              : `<li><span>no goals</span><span>—</span></li>`
          }
        </ul>
        <div class="job-form">
          <input id="goalTitle" placeholder="goal" />
          <input id="goalTarget" placeholder="target note" />
          <select id="goalRealm"><option value="personal">personal</option><option value="work">work</option></select>
          <button type="button" id="goalAdd">SET GOAL</button>
        </div>
      </div>
      <div class="stat-box wide">
        <h3>DAILY ACTIVITIES</h3>
        <ul class="jobs">
          ${
            dash.activitiesToday.length
              ? dash.activitiesToday
                  .map(
                    (a) =>
                      `<li class="row-actions"><span>${a.done ? "✓ " : "· "}${esc(a.title)}</span>
                      <span class="acts">
                        <button type="button" data-act="${a.id}">TOGGLE</button>
                        <button type="button" data-adel="${a.id}">DEL</button>
                      </span></li>`,
                  )
                  .join("")
              : `<li><span>empty day</span><span>—</span></li>`
          }
        </ul>
        <div class="job-form inline">
          <input id="actTitle" placeholder="activity for today" />
          <button type="button" id="actAdd">ADD</button>
        </div>
        <p class="hint">DEL soft-archives after a snapshot — data stays in vault memory</p>
      </div>
    </div>
  `;

  root.querySelector("#projAdd")?.addEventListener("click", async () => {
    const title = (root.querySelector("#projTitle") as HTMLInputElement).value.trim();
    if (!title) return;
    await createProject({
      title,
      notes: (root.querySelector("#projNotes") as HTMLInputElement).value.trim() || undefined,
      realm: (root.querySelector("#projRealm") as HTMLSelectElement).value as "work" | "personal",
      progress: Number((root.querySelector("#projProgress") as HTMLInputElement).value) || 0,
    });
    await renderForge(root);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-bump]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await patchProject(btn.dataset.bump!, { progress: Number(btn.dataset.p) });
      await renderForge(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-pedit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const title = ask("Edit project title", btn.dataset.title ?? "");
      if (title === null) return;
      const progRaw = ask("Progress %", btn.dataset.prog ?? "0");
      if (progRaw === null) return;
      await patchProject(btn.dataset.pedit!, {
        title: title || undefined,
        progress: Number(progRaw),
      });
      await renderForge(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-pdel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Archive this project? Snapshot first — not wiped.")) return;
      await deleteProject(btn.dataset.pdel!);
      await renderForge(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-gedit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const title = ask("Edit goal title", btn.dataset.title ?? "");
      if (title === null) return;
      const progRaw = ask("Progress %", btn.dataset.prog ?? "0");
      if (progRaw === null) return;
      await patchGoal(btn.dataset.gedit!, { title: title || undefined, progress: Number(progRaw) });
      await renderForge(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-gdel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Archive this goal? Snapshot sealed first.")) return;
      await deleteGoal(btn.dataset.gdel!);
      await renderForge(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-adel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Archive activity?")) return;
      await deleteActivity(btn.dataset.adel!);
      await renderForge(root);
    });
  });

  root.querySelector("#goalAdd")?.addEventListener("click", async () => {
    const title = (root.querySelector("#goalTitle") as HTMLInputElement).value.trim();
    if (!title) return;
    await createGoal({
      title,
      target: (root.querySelector("#goalTarget") as HTMLInputElement).value.trim() || undefined,
      realm: (root.querySelector("#goalRealm") as HTMLSelectElement).value as "work" | "personal",
    });
    await renderForge(root);
  });

  root.querySelector("#actAdd")?.addEventListener("click", async () => {
    const title = (root.querySelector("#actTitle") as HTMLInputElement).value.trim();
    if (!title) return;
    await createActivity({ title });
    await renderForge(root);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await toggleActivity(btn.dataset.act!);
      await renderForge(root);
    });
  });
}

export async function renderGold(root: HTMLElement) {
  const dash = await loadDash(root);
  if (!dash) return;
  const f = dash.finance;

  root.innerHTML = `
    <p class="prompt">&gt; G-55 GOLD <span class="blink">_</span></p>
    <p class="lore">Personal ledger. Income minus expense. Charts on M-99 MAP.</p>
    <div class="dash-grid">
      <div class="stat-box">
        <h3>CALCULATIONS</h3>
        <ul class="kpi">
          <li><span>Income</span><b>${money(f.incomeCents)}</b></li>
          <li><span>Expense</span><b>${money(f.expenseCents)}</b></li>
          <li><span>Balance</span><b>${money(f.balanceCents)}</b></li>
        </ul>
        <div class="job-form">
          <select id="finKind"><option value="income">income</option><option value="expense">expense</option><option value="budget">budget</option></select>
          <input id="finAmount" type="number" step="0.01" min="0" placeholder="amount" />
          <input id="finLabel" placeholder="label" />
          <input id="finCat" placeholder="category" />
          <button type="button" id="finAdd">POST ENTRY</button>
        </div>
      </div>
      <div class="stat-box">
        <h3>RECENT</h3>
        <ul class="jobs">
          ${
            f.recent.length
              ? f.recent
                  .map(
                    (e) =>
                      `<li class="row-actions"><span>${esc(e.label)} · ${e.kind} ${money(e.amountCents)}</span>
                      <span class="acts">
                        <button type="button" data-fdel="${e.id}">DEL</button>
                      </span></li>`,
                  )
                  .join("")
              : `<li><span>empty ledger</span><span>—</span></li>`
          }
        </ul>
      </div>
      <div class="stat-box wide">
        <h3>CASH TRACE</h3>
        <div class="cash-wrap">${cashChart(dash.charts.cashSeries)}</div>
      </div>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-fdel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Archive finance row? Snapshot first.")) return;
      await deleteFinance(btn.dataset.fdel!);
      await renderGold(root);
    });
  });

  root.querySelector("#finAdd")?.addEventListener("click", async () => {
    const amount = Number((root.querySelector("#finAmount") as HTMLInputElement).value);
    const label = (root.querySelector("#finLabel") as HTMLInputElement).value.trim();
    if (!label || !(amount > 0)) return;
    await createFinance({
      kind: (root.querySelector("#finKind") as HTMLSelectElement).value as
        | "income"
        | "expense"
        | "budget",
      amount,
      label,
      category: (root.querySelector("#finCat") as HTMLInputElement).value.trim() || undefined,
    });
    await renderGold(root);
  });
}

export async function renderClock(root: HTMLElement) {
  const dash = await loadDash(root);
  if (!dash) return;

  root.innerHTML = `
    <p class="prompt">&gt; C-88 CLOCK <span class="blink">_</span></p>
    <p class="lore">Meetings, reminders, emergency plans. Time is a weapon — keep it sharp.</p>
    <div class="dash-grid">
      <div class="stat-box">
        <h3>MEETINGS</h3>
        <ul class="jobs">
          ${
            dash.meetingsUpcoming.length
              ? dash.meetingsUpcoming
                  .map(
                    (m) =>
                      `<li class="row-actions"><span>${esc(m.title)}${m.place ? " · " + esc(m.place) : ""} · ${new Date(m.startsAt).toLocaleString()}</span>
                      <span class="acts"><button type="button" data-mdel="${m.id}">DEL</button></span></li>`,
                  )
                  .join("")
              : `<li><span>none upcoming</span><span>—</span></li>`
          }
        </ul>
        <div class="job-form">
          <input id="meetTitle" placeholder="meeting title" />
          <input id="meetPlace" placeholder="place / link" />
          <input id="meetStart" type="datetime-local" />
          <input id="meetEnd" type="datetime-local" />
          <button type="button" id="meetAdd">SCHEDULE</button>
        </div>
      </div>
      <div class="stat-box">
        <h3>REMINDERS</h3>
        <ul class="jobs">
          ${
            dash.reminders.length
              ? dash.reminders
                  .map(
                    (r) =>
                      `<li class="row-actions"><span>[${esc(r.priority)}] ${esc(r.title)}</span>
                      <span class="acts">
                        <button type="button" data-rem="${r.id}">DONE</button>
                        <button type="button" data-rdel="${r.id}">DEL</button>
                      </span></li>`,
                  )
                  .join("")
              : `<li><span>board clear</span><span>—</span></li>`
          }
        </ul>
        <div class="job-form">
          <input id="remTitle" placeholder="reminder" />
          <input id="remDue" type="datetime-local" />
          <select id="remPri"><option value="normal">normal</option><option value="high">high</option><option value="low">low</option></select>
          <button type="button" id="remAdd">SET</button>
        </div>
      </div>
      <div class="stat-box wide">
        <h3>EMERGENCIES</h3>
        <ul class="jobs">
          ${
            dash.emergencies.length
              ? dash.emergencies
                  .map(
                    (e) =>
                      `<li class="row-actions"><span class="${e.active ? "hot" : ""}">${e.active ? "LIVE " : "resolved "}${esc(e.severity)} · ${esc(e.title)} — ${esc(e.body)}</span>
                      <span class="acts">
                        ${e.active ? `<button type="button" data-em="${e.id}">RESOLVE</button>` : ""}
                        <button type="button" data-edel="${e.id}">DEL</button>
                      </span></li>`,
                  )
                  .join("")
              : `<li><span>no emergency plans</span><span>—</span></li>`
          }
        </ul>
        <div class="job-form">
          <input id="emTitle" placeholder="emergency title" />
          <input id="emBody" placeholder="protocol / contacts" />
          <select id="emSev"><option value="high">high</option><option value="critical">critical</option><option value="low">low</option></select>
          <button type="button" id="emAdd">ARM PLAN</button>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-mdel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Archive meeting?")) return;
      await deleteMeeting(btn.dataset.mdel!);
      await renderClock(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-rdel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Archive reminder?")) return;
      await deleteReminder(btn.dataset.rdel!);
      await renderClock(root);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-edel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Archive emergency plan?")) return;
      await deleteEmergency(btn.dataset.edel!);
      await renderClock(root);
    });
  });

  root.querySelector("#meetAdd")?.addEventListener("click", async () => {
    const title = (root.querySelector("#meetTitle") as HTMLInputElement).value.trim();
    const startsAt = (root.querySelector("#meetStart") as HTMLInputElement).value;
    const endsAt = (root.querySelector("#meetEnd") as HTMLInputElement).value;
    if (!title || !startsAt || !endsAt) return;
    await createMeeting({
      title,
      place: (root.querySelector("#meetPlace") as HTMLInputElement).value.trim() || undefined,
      startsAt: localIsoFromInput(startsAt),
      endsAt: localIsoFromInput(endsAt),
    });
    await renderClock(root);
  });

  root.querySelector("#remAdd")?.addEventListener("click", async () => {
    const title = (root.querySelector("#remTitle") as HTMLInputElement).value.trim();
    const dueAt = (root.querySelector("#remDue") as HTMLInputElement).value;
    if (!title || !dueAt) return;
    await createReminder({
      title,
      dueAt: localIsoFromInput(dueAt),
      priority: (root.querySelector("#remPri") as HTMLSelectElement).value as
        | "low"
        | "normal"
        | "high",
    });
    await renderClock(root);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-rem]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await completeReminder(btn.dataset.rem!);
      await renderClock(root);
    });
  });

  root.querySelector("#emAdd")?.addEventListener("click", async () => {
    const title = (root.querySelector("#emTitle") as HTMLInputElement).value.trim();
    if (!title) return;
    await createEmergency({
      title,
      body: (root.querySelector("#emBody") as HTMLInputElement).value.trim(),
      severity: (root.querySelector("#emSev") as HTMLSelectElement).value as
        | "low"
        | "high"
        | "critical",
    });
    await renderClock(root);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-em]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await resolveEmergency(btn.dataset.em!);
      await renderClock(root);
    });
  });
}

export async function renderHub(root: HTMLElement) {
  root.innerHTML = `<p class="prompt">&gt; G-77 HUB · GITHUB <span class="blink">_</span></p><p class="lore">Loading GitHub projects…</p>`;
  try {
    const data = await listGithubRepos();
    root.innerHTML = `
      <p class="prompt">&gt; G-77 HUB · @${esc(data.login)} <span class="blink">_</span></p>
      <p class="lore">
        ${data.count} repos · avg done <strong>${data.avgProgress}%</strong> · remains <strong>${data.avgRemaining}%</strong>
        · ${data.authenticated ? "token auth" : "public API"}
      </p>
      <div class="dash-grid">
        <div class="stat-box wide">
          <h3>PROJECT COMPLETION</h3>
          <ul class="jobs gh-list">
            ${
              data.projects.length
                ? data.projects
                    .map(
                      (p) => `
              <li class="gh-row">
                <div class="gh-head">
                  <a href="${esc(p.url)}" target="_blank" rel="noreferrer">${esc(p.name)}</a>
                  <span>${p.progress}% done · ${p.remaining}% left${p.overridden ? " · SET" : " · AUTO"}</span>
                </div>
                <div class="bar-track"><i style="width:${p.progress}%"></i></div>
                <div class="gh-meta">${esc(p.language || "n/a")} · ${esc((p.description || "no description").slice(0, 80))}</div>
                <div class="acts">
                  <button type="button" data-gh="${esc(p.fullName)}" data-p="${p.progress}">SET %</button>
                  <a class="linkish" href="${esc(p.url)}" target="_blank" rel="noreferrer">OPEN</a>
                </div>
              </li>`,
                    )
                    .join("")
                : `<li><span>no repos found</span><span>—</span></li>`
            }
          </ul>
        </div>
      </div>
      <p class="hint">AUTO = GitHub signals · SET % stores durable override in vault · never wipes history</p>
    `;

    root.querySelectorAll<HTMLButtonElement>("[data-gh]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const raw = ask(`Completion % for ${btn.dataset.gh}`, btn.dataset.p ?? "0");
        if (raw === null) return;
        const n = Math.min(100, Math.max(0, Number(raw)));
        if (Number.isNaN(n)) return;
        await setGithubProgress(btn.dataset.gh!, n);
        await renderHub(root);
      });
    });
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : "github_failed";
    root.innerHTML = `<p class="prompt">&gt; G-77 HUB</p><p class="msg bad">${esc(msg)}</p>
      <p class="hint">Public fetch uses Arnold-RG. Optional GITHUB_TOKEN in backend/.env for higher limits.</p>`;
  }
}

export async function renderMap(root: HTMLElement) {
  const dash = await loadDash(root);
  if (!dash) return;

  root.innerHTML = `
    <p class="prompt">&gt; M-99 MAP <span class="blink">_</span></p>
    <p class="lore">Progress, direction, and cash speed. Drawn from your vault — not decoration.</p>
    <div class="dash-grid">
      <div class="stat-box wide">
        <h3>DIRECTION VECTOR</h3>
        ${directionMap(dash)}
      </div>
      <div class="stat-box">
        <h3>PROJECT SPEED</h3>
        ${
          dash.charts.speedBars.length
            ? dash.charts.speedBars.map((b) => barRow(b.label, b.value, b.realm)).join("")
            : `<p class="hint">Forge projects to fill the chart.</p>`
        }
      </div>
      <div class="stat-box">
        <h3>GOAL PULSE</h3>
        ${
          dash.goals.length
            ? dash.goals
                .slice(0, 8)
                .map((g) => barRow(g.title, g.progress, "amber"))
                .join("")
            : `<p class="hint">No goals yet.</p>`
        }
      </div>
      <div class="stat-box wide">
        <h3>CASH DIRECTION</h3>
        <div class="cash-wrap tall">${cashChart(dash.charts.cashSeries)}</div>
        <p class="hint">BALANCE ${money(dash.finance.balanceCents)} · IN ${money(dash.finance.incomeCents)} · OUT ${money(dash.finance.expenseCents)}</p>
      </div>
    </div>
  `;
}
