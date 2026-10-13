import {
  chatAi,
  completeFocus,
  createFocus,
  createJob,
  deleteJob,
  getBriefing,
  getMode,
  listFocus,
  listJobs,
  setMode,
} from "../api/secretary";
import { ApiError } from "../api/client";
import { logout } from "../api/auth";
import { clearSession } from "../state/session";
import { say } from "./dom";
import { createMicWatcher } from "./mic";

function spriteHtml(cls: string, id?: string) {
  return `
    <div class="sprite ${cls}" ${id ? `id="${id}"` : ""} aria-hidden="true">
      <div class="s-head"></div><div class="s-eye"></div><div class="s-eye r"></div>
      <div class="s-body"></div><div class="s-arm l"></div><div class="s-arm r"></div>
      <div class="s-leg l"></div><div class="s-leg r"></div>
    </div>`;
}

export async function renderChamber(root: HTMLElement, onLogout: () => void) {
  root.innerHTML = `
    <header class="room-head">
      <p class="room-index">W-02</p>
      <h2 class="prompt" tabindex="-1">Hall</h2>
    </header>
    <p class="lore">The day starts here. The warden, the scribe, and the scout keep their posts. Talk listens on this device. Cast asks your secretary.</p>
    <p class="msg" data-room-msg role="status"></p>
    <div class="world">
      <div class="stage" id="hallStage">
        <div class="stage-wall" aria-hidden="true"></div>
        <div class="stage-window" aria-hidden="true"></div>
        <div class="stage-floor" aria-hidden="true"></div>
        <div class="torch l" aria-hidden="true"></div>
        <div class="torch r" aria-hidden="true"></div>
        <p class="speech" id="npcLine">The warden says the seals hold.</p>
        ${spriteHtml("guard")}
        ${spriteHtml("clerk amber", "voiceJumper")}
        ${spriteHtml("scout blood")}
      </div>
      <div class="side-panel">
        <section class="stat-box">
          <h3>Align</h3>
          <div class="modes" role="group" aria-label="Mode">
            <button type="button" data-mode="work" aria-pressed="true">Work</button>
            <button type="button" data-mode="personal" aria-pressed="false">Personal</button>
          </div>
        </section>
        <section class="stat-box">
          <h3>Dawn scroll</h3>
          <p id="briefingLine">Opening the scroll…</p>
        </section>
        <section class="stat-box">
          <h3>Focus</h3>
          <p id="focusLine">—</p>
          <form class="stack" id="focusForm">
            <label class="field"><span>Label</span><input id="focusLabel" maxlength="120" autocomplete="off" /></label>
            <div class="form-actions">
              <button type="submit" class="primary">Add a 90 minute block</button>
              <button type="button" id="focusDone" class="ghost" hidden>Mark complete</button>
            </div>
          </form>
        </section>
        <section class="stat-box">
          <h3>Quest log</h3>
          <ul class="jobs" id="jobList"></ul>
          <form class="stack" id="jobForm">
            <label class="field"><span>Role</span><input id="jobTitle" maxlength="160" autocomplete="off" /></label>
            <label class="field"><span>Company</span><input id="jobCompany" maxlength="160" autocomplete="off" /></label>
            <button type="submit" class="primary">Add quest</button>
          </form>
        </section>
        <section class="stat-box">
          <button type="button" id="logoutBtn" class="ghost">Sign out</button>
          <button type="button" id="stillHall" class="ghost" aria-pressed="false">Still the hall</button>
        </section>
      </div>
    </div>

    <form class="cmd" id="castForm">
      <button type="button" id="micBtn" aria-pressed="false">Talk</button>
      <label class="sr-only" for="chatIn">Ask Ragi</label>
      <input id="chatIn" type="text" maxlength="4000" autocomplete="off" placeholder="Ask, or begin with Hey Ragi" />
      <button type="submit" id="sendBtn" class="primary">Cast</button>
    </form>
    <div class="voice-meter" id="voiceMeter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Microphone level"><span id="voiceLevel"></span></div>
    <div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-relevant="additions"></div>
    <p class="hint">Talk opens the microphone and the amber scribe jumps when it hears you. Cast uses the local secretary, or Gemini when a key is set on the server. Home is the day’s board.</p>
  `;

  const npcLine = root.querySelector("#npcLine") as HTMLElement;
  const jumper = root.querySelector("#voiceJumper") as HTMLElement;
  const voiceLevel = root.querySelector("#voiceLevel") as HTMLElement;
  const voiceMeter = root.querySelector("#voiceMeter") as HTMLElement;
  const briefingLine = root.querySelector("#briefingLine") as HTMLElement;
  const focusLine = root.querySelector("#focusLine") as HTMLElement;
  const focusDone = root.querySelector("#focusDone") as HTMLButtonElement;
  const jobList = root.querySelector("#jobList") as HTMLElement;
  const chatLog = root.querySelector("#chatLog") as HTMLElement;
  const chatIn = root.querySelector("#chatIn") as HTMLInputElement;
  const micBtn = root.querySelector("#micBtn") as HTMLButtonElement;
  const stage = root.querySelector("#hallStage") as HTMLElement;
  const stillBtn = root.querySelector("#stillHall") as HTMLButtonElement;

  let mode: "work" | "personal" = "work";
  let focusId = "";

  const lines = [
    "The warden says the seals hold.",
    "The scribe has the dawn scroll ready.",
    "The scout is watching the quests.",
    "Say hello when you want a status.",
    "Work and personal are both kept in this house.",
  ];
  let li = 0;
  const speechTimer = window.setInterval(() => {
    if (document.hidden) return;
    li = (li + 1) % lines.length;
    if (!micBtn.classList.contains("is-hot")) npcLine.textContent = lines[li];
  }, 4200);

  if (sessionStorage.getItem("ragi.hall.still") === "1") {
    stage.classList.add("is-still");
    stillBtn.setAttribute("aria-pressed", "true");
    stillBtn.textContent = "Let the hall move";
  }
  stillBtn.addEventListener("click", () => {
    const still = !stage.classList.contains("is-still");
    stage.classList.toggle("is-still", still);
    stillBtn.setAttribute("aria-pressed", String(still));
    stillBtn.textContent = still ? "Let the hall move" : "Still the hall";
    sessionStorage.setItem("ragi.hall.still", still ? "1" : "0");
  });

  const mic = createMicWatcher({
    onLevel: (level) => {
      const pct = Math.round(level * 100);
      voiceLevel.style.width = `${pct}%`;
      voiceMeter.setAttribute("aria-valuenow", String(pct));
    },
    onSpeak: () => {
      jumper.classList.remove("is-jumping");
      void jumper.offsetWidth;
      jumper.classList.add("is-jumping");
      npcLine.textContent = "The scribe hears you.";
      window.setTimeout(() => jumper.classList.remove("is-jumping"), 280);
    },
  });

  function addChat(who: "you" | "ragi", text: string) {
    const div = document.createElement("div");
    div.className = `line ${who}`;
    const name = document.createElement("span");
    name.className = "who";
    name.textContent = who === "you" ? "You" : "Ragi";
    const body = document.createElement("p");
    body.textContent = text;
    div.append(name, body);
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function refresh() {
    try {
      const [m, b, jobs, focus] = await Promise.all([getMode(), getBriefing(), listJobs(), listFocus()]);
      mode = m.mode === "personal" ? "personal" : "work";
      root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode));
      });
      briefingLine.textContent = b.briefing.summary;
      const open = focus.blocks.filter((x) => !x.completed)[0];
      focusId = open?.id ?? "";
      focusDone.hidden = !open;
      focusLine.textContent = open
        ? `${open.label} · until ${new Date(open.endsAt).toLocaleTimeString()}`
        : "No active block.";
      jobList.replaceChildren();
      if (!jobs.jobs.length) {
        const empty = document.createElement("li");
        empty.className = "entry is-empty";
        empty.innerHTML = `<p class="entry-title">No quests yet.</p>`;
        jobList.append(empty);
      } else {
        for (const job of jobs.jobs.slice(0, 6)) {
          const li = document.createElement("li");
          li.className = "entry";
          const copy = document.createElement("div");
          copy.className = "entry-copy";
          const title = document.createElement("p");
          title.className = "entry-title";
          title.textContent = job.company ? `${job.title} · ${job.company}` : job.title;
          const meta = document.createElement("p");
          meta.className = "entry-meta";
          meta.textContent = job.status;
          copy.append(title, meta);
          const acts = document.createElement("div");
          acts.className = "acts";
          const del = document.createElement("button");
          del.type = "button";
          del.className = "ghost";
          del.textContent = "Archive";
          del.addEventListener("click", () => {
            if (!window.confirm("Archive this quest? A snapshot is sealed first.")) return;
            void guardJob(async () => {
              await deleteJob(job.id);
              await refresh();
            });
          });
          acts.append(del);
          li.append(copy, acts);
          jobList.append(li);
        }
      }
    } catch (err) {
      briefingLine.textContent = err instanceof ApiError ? err.message : "The secretary could not refresh.";
    }
  }

  async function guardJob(work: () => Promise<void>) {
    try {
      await work();
    } catch (err) {
      say(root, err instanceof ApiError ? err.message : "The hall could not do that.", "bad");
    }
  }

  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.mode === "personal" ? "personal" : "work";
      void guardJob(async () => {
        await setMode(next);
        mode = next;
        await refresh();
      });
    });
  });

  root.querySelector("#jobForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = (root.querySelector("#jobTitle") as HTMLInputElement).value.trim();
    const company = (root.querySelector("#jobCompany") as HTMLInputElement).value.trim();
    if (!title) {
      say(root, "Add a role title first.", "bad");
      return;
    }
    void guardJob(async () => {
      await createJob({ title, company: company || undefined, status: "watch" });
      (root.querySelector("#jobTitle") as HTMLInputElement).value = "";
      (root.querySelector("#jobCompany") as HTMLInputElement).value = "";
      say(root, "Quest added.", "good");
      await refresh();
    });
  });

  root.querySelector("#focusForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const label = (root.querySelector("#focusLabel") as HTMLInputElement).value.trim() || "Deep work";
    const startsAt = new Date();
    const endsAt = new Date(Date.now() + 90 * 60 * 1000);
    void guardJob(async () => {
      await createFocus({ label, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
      (root.querySelector("#focusLabel") as HTMLInputElement).value = "";
      say(root, "Focus block started.", "good");
      await refresh();
    });
  });

  focusDone.addEventListener("click", () => {
    if (!focusId) return;
    void guardJob(async () => {
      await completeFocus(focusId);
      say(root, "Focus marked complete.", "good");
      await refresh();
    });
  });

  micBtn.addEventListener("click", () => {
    if (mic.active()) {
      mic.stop();
      jumper.classList.remove("is-listening");
      micBtn.classList.remove("is-hot");
      micBtn.textContent = "Talk";
      micBtn.setAttribute("aria-pressed", "false");
      return;
    }
    void mic.start().then(
      () => {
        jumper.classList.add("is-listening");
        micBtn.classList.add("is-hot");
        micBtn.textContent = "Live";
        micBtn.setAttribute("aria-pressed", "true");
        npcLine.textContent = "The scribe is listening.";
      },
      () => {
        npcLine.textContent = "The microphone is blocked. Allow it in the browser if you want to talk.";
      },
    );
  });

  async function cast() {
    const message = chatIn.value.trim();
    if (!message) return;
    const wake = /^hey\s+ragi\b/i.test(message);
    const text = wake ? message.replace(/^hey\s+ragi[,!\s]*/i, "").trim() || "Status report." : message;
    addChat("you", message);
    chatIn.value = "";
    try {
      const res = await chatAi(text, mode);
      addChat("ragi", res.reply);
      npcLine.textContent = res.signal === "gemini" ? "Ragi answered from the cloud." : "Ragi answered from your vault.";
    } catch (err) {
      const label = err instanceof ApiError ? err.message : "cast failed";
      addChat("ragi", `The signal dropped. ${label}`);
    }
  }

  root.querySelector("#castForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void cast();
  });

  root.querySelector("#logoutBtn")?.addEventListener("click", () => {
    void leave();
  });

  async function leave() {
    try {
      await logout();
    } catch {
      /* the local session still ends */
    }
    mic.stop();
    window.clearInterval(speechTimer);
    clearSession();
    onLogout();
  }

  await refresh();

  return () => {
    mic.stop();
    window.clearInterval(speechTimer);
  };
}
