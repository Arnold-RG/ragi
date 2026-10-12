import {
  chatAi,
  createFocus,
  createJob,
  getBriefing,
  getMode,
  listFocus,
  listJobs,
  setMode,
} from "../api/secretary";
import { ApiError } from "../api/client";
import { logout } from "../api/auth";
import { clearSession } from "../state/session";
import { createMicWatcher } from "./mic";

function spriteHtml(cls: string, id?: string) {
  return `
    <div class="sprite ${cls}" ${id ? `id="${id}"` : ""}>
      <div class="s-head"></div><div class="s-eye"></div><div class="s-eye r"></div>
      <div class="s-body"></div><div class="s-arm l"></div><div class="s-arm r"></div>
      <div class="s-leg l"></div><div class="s-leg r"></div>
    </div>`;
}

export async function renderChamber(root: HTMLElement, onLogout: () => void) {
  root.innerHTML = `
    <p class="prompt">&gt; HALL OF RAGI <span class="blink">_</span></p>
    <div class="world">
      <div class="stage" aria-label="Live characters">
        <div class="stage-wall"></div>
        <div class="stage-floor"></div>
        <div class="torch l"></div>
        <div class="torch r"></div>
        <div class="speech" id="npcLine">WARDEN: seals hold…</div>
        ${spriteHtml("guard")}
        ${spriteHtml("clerk amber", "voiceJumper")}
        ${spriteHtml("scout blood")}
      </div>
      <div class="side-panel">
        <div class="stat-box">
          <h3>ALIGN</h3>
          <div class="modes">
            <button type="button" data-mode="work" aria-pressed="true">WORK</button>
            <button type="button" data-mode="personal" aria-pressed="false">HOME</button>
          </div>
        </div>
        <div class="stat-box">
          <h3>DAWN SCROLL</h3>
          <div id="briefingLine">loading…</div>
        </div>
        <div class="stat-box">
          <h3>FOCUS</h3>
          <div id="focusLine">—</div>
          <div class="job-form">
            <input id="focusLabel" placeholder="focus label" />
            <button type="button" id="focusAdd">ADD 90M BLOCK</button>
          </div>
        </div>
        <div class="stat-box">
          <h3>QUEST LOG</h3>
          <ul class="jobs" id="jobList"></ul>
          <div class="job-form">
            <input id="jobTitle" placeholder="role title" />
            <input id="jobCompany" placeholder="company" />
            <button type="button" id="jobAdd">ADD QUEST</button>
          </div>
        </div>
        <div class="stat-box">
          <button type="button" id="logoutBtn">BREAK SEALS / LOGOUT</button>
        </div>
      </div>
    </div>

    <div class="cmd">
      <button type="button" id="micBtn">TALK</button>
      <input id="chatIn" type="text" placeholder="speak or type · Hey Ragi…" />
      <button type="button" id="sendBtn">CAST</button>
    </div>
    <div class="voice-meter" aria-hidden="true"><span id="voiceLevel"></span></div>
    <div class="chat-log" id="chatLog"></div>
    <p class="hint">TALK = MIC · AMBER SCRIBE JUMPS ON VOICE · CAST SENDS TO BACKEND GEMINI</p>
  `;

  const npcLine = root.querySelector("#npcLine") as HTMLElement;
  const jumper = root.querySelector("#voiceJumper") as HTMLElement;
  const voiceLevel = root.querySelector("#voiceLevel") as HTMLElement;
  const briefingLine = root.querySelector("#briefingLine") as HTMLElement;
  const focusLine = root.querySelector("#focusLine") as HTMLElement;
  const jobList = root.querySelector("#jobList") as HTMLElement;
  const chatLog = root.querySelector("#chatLog") as HTMLElement;
  const chatIn = root.querySelector("#chatIn") as HTMLInputElement;
  const micBtn = root.querySelector("#micBtn") as HTMLButtonElement;

  let mode: "work" | "personal" = "work";

  const lines = [
    "WARDEN: seals hold…",
    "SCRIBE: dawn scroll ready",
    "SCOUT: quests await",
    "WARDEN: say Hey Ragi",
    "SCRIBE: work / home align",
  ];
  let li = 0;
  const speechTimer = window.setInterval(() => {
    li = (li + 1) % lines.length;
    if (!micBtn.classList.contains("is-hot")) npcLine.textContent = lines[li];
  }, 3200);

  const mic = createMicWatcher({
    onLevel: (level) => {
      voiceLevel.style.width = `${Math.round(level * 100)}%`;
    },
    onSpeak: () => {
      jumper.classList.remove("is-jumping");
      void jumper.offsetWidth;
      jumper.classList.add("is-jumping");
      npcLine.textContent = "SCRIBE: hears the owner!";
      window.setTimeout(() => jumper.classList.remove("is-jumping"), 280);
    },
  });

  function addChat(who: "you" | "ragi", text: string) {
    const div = document.createElement("div");
    div.className = `line ${who}`;
    div.textContent = `${who === "you" ? "YOU" : "RAGI"} :: ${text}`;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function refresh() {
    try {
      const [m, b, jobs, focus] = await Promise.all([
        getMode(),
        getBriefing(),
        listJobs(),
        listFocus(),
      ]);
      mode = m.mode === "personal" ? "personal" : "work";
      root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode));
      });
      briefingLine.textContent = b.briefing.summary;
      const open = focus.blocks.filter((x) => !x.completed)[0];
      focusLine.textContent = open
        ? `${open.label} · until ${new Date(open.endsAt).toLocaleTimeString()}`
        : "no active block";
      jobList.innerHTML = jobs.jobs.length
        ? jobs.jobs
            .slice(0, 6)
            .map((j) => `<li><span>${j.title}${j.company ? " · " + j.company : ""}</span><span>${j.status}</span></li>`)
            .join("")
        : `<li><span>no quests yet</span><span>—</span></li>`;
    } catch (err) {
      briefingLine.textContent =
        err instanceof ApiError ? `backend :: ${err.message}` : "backend refresh failed";
    }
  }

  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const next = btn.dataset.mode === "personal" ? "personal" : "work";
      await setMode(next);
      mode = next;
      await refresh();
    });
  });

  root.querySelector("#jobAdd")?.addEventListener("click", async () => {
    const title = (root.querySelector("#jobTitle") as HTMLInputElement).value.trim();
    const company = (root.querySelector("#jobCompany") as HTMLInputElement).value.trim();
    if (!title) return;
    await createJob({ title, company: company || undefined, status: "watch" });
    (root.querySelector("#jobTitle") as HTMLInputElement).value = "";
    (root.querySelector("#jobCompany") as HTMLInputElement).value = "";
    await refresh();
  });

  root.querySelector("#focusAdd")?.addEventListener("click", async () => {
    const label =
      (root.querySelector("#focusLabel") as HTMLInputElement).value.trim() || "Deep work";
    const startsAt = new Date();
    const endsAt = new Date(Date.now() + 90 * 60 * 1000);
    await createFocus({
      label,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    await refresh();
  });

  micBtn.addEventListener("click", async () => {
    if (mic.active()) {
      mic.stop();
      jumper.classList.remove("is-listening");
      micBtn.classList.remove("is-hot");
      micBtn.textContent = "TALK";
      return;
    }
    try {
      await mic.start();
      jumper.classList.add("is-listening");
      micBtn.classList.add("is-hot");
      micBtn.textContent = "LIVE";
      npcLine.textContent = "SCRIBE: mic open — speak";
    } catch {
      npcLine.textContent = "SCRIBE: mic blocked — allow microphone";
    }
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
      npcLine.textContent = "RAGI: answered";
    } catch (err) {
      const label = err instanceof ApiError ? err.message : "cast_failed";
      addChat("ragi", `(signal lost :: ${label})`);
    }
  }

  root.querySelector("#sendBtn")?.addEventListener("click", () => void cast());
  chatIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void cast();
  });

  root.querySelector("#logoutBtn")?.addEventListener("click", async () => {
    try {
      await logout();
    } catch {
      /* ignore */
    }
    mic.stop();
    window.clearInterval(speechTimer);
    clearSession();
    onLogout();
  });

  await refresh();

  return () => {
    mic.stop();
    window.clearInterval(speechTimer);
  };
}
