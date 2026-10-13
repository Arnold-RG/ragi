import { getDashboard, money } from "../api/life";
import { listGithubRepos } from "../api/github";
import { ApiError } from "../api/client";
import { esc, say } from "./dom";

const FOCUS_KEY = "ragi.pulse.focus";
const STREAK_KEY = "ragi.pulse.streak";
const REVIEW_KEY = "ragi.pulse.review";

type FocusState = { endsAt: number; seconds: number; running: boolean; label: string };
type StreakState = { days: number; lastDay: string };
type ReviewState = Record<string, boolean>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadFocus(): FocusState {
  try {
    const raw = localStorage.getItem(FOCUS_KEY);
    if (raw) return JSON.parse(raw) as FocusState;
  } catch {
    /* ignore */
  }
  return { endsAt: 0, seconds: 25 * 60, running: false, label: "Deep work" };
}

function saveFocus(state: FocusState) {
  localStorage.setItem(FOCUS_KEY, JSON.stringify(state));
}

function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw) as StreakState;
  } catch {
    /* ignore */
  }
  return { days: 0, lastDay: "" };
}

function bumpStreak() {
  const s = loadStreak();
  const d = today();
  if (s.lastDay === d) return s;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  s.days = s.lastDay === yesterday ? s.days + 1 : 1;
  s.lastDay = d;
  localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  return s;
}

function loadReview(): ReviewState {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { day: string; items: ReviewState };
      if (parsed.day === today()) return parsed.items;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveReview(items: ReviewState) {
  localStorage.setItem(REVIEW_KEY, JSON.stringify({ day: today(), items }));
}

const REVIEW_ITEMS = [
  { id: "ship", label: "Ship one concrete artifact" },
  { id: "triage", label: "Triage open GitHub issues" },
  { id: "cash", label: "Log today's money moves" },
  { id: "calls", label: "Confirm tomorrow's calls" },
  { id: "notes", label: "Capture one note for next week" },
];

function fmtTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export async function renderPulse(root: HTMLElement) {
  root.innerHTML = `<header class="page-head"><h2 class="page-title" tabindex="-1">Pulse</h2><p class="page-sub">Loading studio…</p></header>`;

  let dashSummary = "Vault ready.";
  let ghLine = "Connect GitHub in Work for live production scores.";
  try {
    const dash = await getDashboard();
    const open = dash.activitiesToday.filter((a) => !a.done).length;
    dashSummary = `${open} open tasks · ${dash.projects.length} projects · ${money(dash.finance.balanceCents)} cash · ${dash.meetingsUpcoming.length} calls`;
  } catch (err) {
    dashSummary = err instanceof ApiError ? err.message : "Board offline.";
  }
  try {
    const gh = await listGithubRepos();
    if (!gh.needsLogin && gh.intel) {
      ghLine = `@${gh.intel.login} · production ${gh.intel.productionPercent}% · pace ${gh.intel.performanceScore}/100 · errors ${gh.intel.errorRatePercent}%`;
    } else if (!gh.needsLogin && gh.login) {
      ghLine = `@${gh.login} · ${gh.count} repos · avg ${gh.avgProgress}%`;
    }
  } catch {
    /* optional */
  }

  let focus = loadFocus();
  let streak = loadStreak();
  let review = loadReview();
  let tick: number | null = null;

  const remaining = () => {
    if (!focus.running) return focus.seconds;
    return Math.max(0, Math.round((focus.endsAt - Date.now()) / 1000));
  };

  const paint = () => {
    const left = remaining();
    const reviewDone = REVIEW_ITEMS.filter((i) => review[i.id]).length;
    root.innerHTML = `
      <header class="page-head">
        <h2 class="page-title" tabindex="-1">Pulse</h2>
        <p class="page-sub">Focus studio — timer, weekly review, momentum, and live vault signals.</p>
        <p class="msg" data-room-msg role="status"></p>
      </header>

      <div class="board">
        <section class="pulse-hero" data-reveal>
          <div class="pulse-hero-copy">
            <p class="pulse-kicker">Live desk</p>
            <h3>Keep the day moving</h3>
            <p>${esc(dashSummary)}</p>
            <p class="quiet">${esc(ghLine)}</p>
          </div>
          <div class="pulse-hero-art" aria-hidden="true">
            <span class="pulse-orb o1"></span>
            <span class="pulse-orb o2"></span>
            <svg class="pulse-svg" viewBox="0 0 240 120" fill="none">
              <path data-draw d="M10 80 C40 20, 80 20, 110 60 S180 110, 230 40" stroke="#3d9a6e" stroke-width="2.5" stroke-linecap="round"/>
              <path data-draw d="M10 95 C50 55, 90 95, 130 70 S190 30, 230 70" stroke="#d4a06a" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
            </svg>
          </div>
        </section>

        <div class="pulse-ticker" aria-hidden="true">
          <div class="pulse-ticker-track">
            <span>Deep work · Ship daily · Triage issues · Protect focus · Log cash · Clear calls · Review weekly ·</span>
            <span>Deep work · Ship daily · Triage issues · Protect focus · Log cash · Clear calls · Review weekly ·</span>
          </div>
        </div>

        <div class="board-strip">
          <article class="board-metric pulse-stat"><p class="label">Focus left</p><p class="value" id="focusReadout">${fmtTime(left)}</p><p class="note">${esc(focus.label)}</p></article>
          <article class="board-metric pulse-stat"><p class="label">Streak</p><p class="value">${streak.days}</p><p class="note">Days with a finished focus</p></article>
          <article class="board-metric pulse-stat"><p class="label">Review</p><p class="value">${reviewDone}/${REVIEW_ITEMS.length}</p><p class="note">Weekly checklist today</p></article>
          <article class="board-metric pulse-stat"><p class="label">Mode</p><p class="value" style="font-size:1.15rem">${focus.running ? "Live" : "Idle"}</p><p class="note">Timer state</p></article>
        </div>

        <div class="two-col">
          <section class="panel-card pulse-block" data-reveal>
            <div class="board-section-head">
              <h3>Focus timer</h3>
              <p>Pomodoro-style deep work</p>
            </div>
            <div class="focus-face">
              <p class="focus-clock" id="focusClock">${fmtTime(left)}</p>
              <p class="quiet">Finish a block to grow your streak.</p>
            </div>
            <div class="focus-presets">
              <button type="button" class="ghost" data-mins="25">25m</button>
              <button type="button" class="ghost" data-mins="45">45m</button>
              <button type="button" class="ghost" data-mins="15">15m</button>
              <button type="button" class="ghost" data-mins="5">5m break</button>
            </div>
            <label class="field" style="margin-top:0.75rem"><span>Label</span>
              <input id="focusLabel" maxlength="80" value="${esc(focus.label)}" />
            </label>
            <div class="focus-actions">
              <button type="button" class="primary" id="focusToggle">${focus.running ? "Pause" : "Start focus"}</button>
              <button type="button" class="ghost" id="focusReset">Reset</button>
            </div>
          </section>

          <section class="panel-card pulse-block" data-reveal>
            <div class="board-section-head">
              <h3>Weekly review</h3>
              <p>Five moves that keep the vault honest</p>
            </div>
            <ul class="jobs" id="reviewList">
              ${REVIEW_ITEMS.map(
                (item) => `<li class="entry">
                  <div class="entry-copy"><p class="entry-title">${review[item.id] ? "✓ " : ""}${esc(item.label)}</p></div>
                  <div class="acts"><button type="button" class="ghost" data-review="${item.id}">${review[item.id] ? "Undo" : "Done"}</button></div>
                </li>`,
              ).join("")}
            </ul>
          </section>
        </div>

        <section class="panel-card pulse-block" data-reveal>
          <div class="board-section-head">
            <h3>Command shortcuts</h3>
            <p>Jump into the rooms that move the needle</p>
          </div>
          <div class="pulse-commands">
            <button type="button" class="pulse-cmd" data-jump="home"><strong>Today</strong><span>Tasks & calls</span></button>
            <button type="button" class="pulse-cmd" data-jump="forge"><strong>Work</strong><span>GitHub intel</span></button>
            <button type="button" class="pulse-cmd" data-jump="hall"><strong>Ask</strong><span>Secretary brief</span></button>
            <button type="button" class="pulse-cmd" data-jump="clock"><strong>Schedule</strong><span>Meetings</span></button>
            <button type="button" class="pulse-cmd" data-jump="gold"><strong>Money</strong><span>Cash board</span></button>
            <button type="button" class="pulse-cmd" data-jump="den"><strong>Notes</strong><span>Capture</span></button>
          </div>
        </section>

        <section class="panel-card pulse-block" data-reveal>
          <div class="board-section-head">
            <h3>Momentum path</h3>
            <p>Scroll-drawn signal — keep the curve climbing</p>
          </div>
          <svg class="pulse-svg wide" viewBox="0 0 640 160" fill="none" aria-hidden="true">
            <path data-draw d="M20 120 C80 120, 100 40, 160 40 S240 120, 300 80 S420 20, 500 60 S580 130, 620 90" stroke="#3d9a6e" stroke-width="3" stroke-linecap="round"/>
            <path data-draw d="M20 140 C120 100, 200 140, 320 100 S480 40, 620 110" stroke="#85948c" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>
          </svg>
        </section>
      </div>
    `;

    const syncClocks = () => {
      const t = fmtTime(remaining());
      const a = root.querySelector("#focusClock");
      const b = root.querySelector("#focusReadout");
      if (a) a.textContent = t;
      if (b) b.textContent = t;
    };

    const stopTick = () => {
      if (tick != null) {
        window.clearInterval(tick);
        tick = null;
      }
    };

    const startTick = () => {
      stopTick();
      tick = window.setInterval(() => {
        const leftNow = remaining();
        syncClocks();
        if (leftNow <= 0 && focus.running) {
          focus.running = false;
          focus.seconds = 0;
          saveFocus(focus);
          streak = bumpStreak();
          stopTick();
          say(root, "Focus block complete. Streak updated.", "good");
          paint();
        }
      }, 250);
    };

    root.querySelectorAll<HTMLButtonElement>("[data-mins]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mins = Number(btn.dataset.mins);
        focus.running = false;
        focus.seconds = mins * 60;
        focus.endsAt = 0;
        focus.label = mins === 5 ? "Break" : (root.querySelector("#focusLabel") as HTMLInputElement)?.value.trim() || focus.label;
        saveFocus(focus);
        paint();
      });
    });

    root.querySelector("#focusToggle")?.addEventListener("click", () => {
      const labelEl = root.querySelector("#focusLabel") as HTMLInputElement | null;
      if (labelEl?.value.trim()) focus.label = labelEl.value.trim();
      if (focus.running) {
        focus.seconds = remaining();
        focus.running = false;
        focus.endsAt = 0;
        saveFocus(focus);
        stopTick();
        paint();
        return;
      }
      if (focus.seconds <= 0) focus.seconds = 25 * 60;
      focus.running = true;
      focus.endsAt = Date.now() + focus.seconds * 1000;
      saveFocus(focus);
      paint();
    });

    root.querySelector("#focusReset")?.addEventListener("click", () => {
      focus = { endsAt: 0, seconds: 25 * 60, running: false, label: "Deep work" };
      saveFocus(focus);
      stopTick();
      paint();
    });

    root.querySelectorAll<HTMLButtonElement>("[data-review]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.review!;
        review[id] = !review[id];
        saveReview(review);
        paint();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const room = btn.dataset.jump!;
        window.dispatchEvent(new CustomEvent("ragi:goto", { detail: { room } }));
      });
    });

    if (focus.running) startTick();
    else stopTick();

    window.dispatchEvent(new CustomEvent("ragi:motion", { detail: { root } }));
  };

  paint();

  return () => {
    if (tick != null) window.clearInterval(tick);
  };
}
