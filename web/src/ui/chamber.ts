import { chatAi, getBriefing, getMode, setMode } from "../api/secretary";
import { ApiError } from "../api/client";
import { say } from "./dom";
import { createMicWatcher } from "./mic";

export async function renderChamber(root: HTMLElement, _onLogout: () => void) {
  root.innerHTML = `
    <header class="page-head">
      <h2 class="page-title" tabindex="-1">Ask RAGI</h2>
      <p class="page-sub">Talk or type. RAGI answers from your sealed account.</p>
    </header>
    <p class="msg" data-room-msg role="status"></p>

    <div class="ask-layout">
      <section class="ask-panel">
        <div class="ask-modes" role="group" aria-label="Mode">
          <button type="button" data-mode="work" aria-pressed="true">Work</button>
          <button type="button" data-mode="personal" aria-pressed="false">Personal</button>
        </div>
        <p class="ask-brief" id="briefingLine">Loading your brief…</p>
        <div class="chat-log ask-log" id="chatLog" role="log" aria-live="polite" aria-relevant="additions"></div>
        <form class="ask-cmd" id="castForm">
          <button type="button" id="micBtn" class="ghost" aria-pressed="false">Talk</button>
          <label class="sr-only" for="chatIn">Message</label>
          <input id="chatIn" type="text" maxlength="4000" autocomplete="off" placeholder="Ask anything…" />
          <button type="submit" id="sendBtn" class="primary">Send</button>
        </form>
        <div class="voice-meter" id="voiceMeter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Microphone level"><span id="voiceLevel"></span></div>
      </section>
    </div>
  `;

  const briefingLine = root.querySelector("#briefingLine") as HTMLElement;
  const chatLog = root.querySelector("#chatLog") as HTMLElement;
  const chatIn = root.querySelector("#chatIn") as HTMLInputElement;
  const micBtn = root.querySelector("#micBtn") as HTMLButtonElement;
  const voiceLevel = root.querySelector("#voiceLevel") as HTMLElement;
  const voiceMeter = root.querySelector("#voiceMeter") as HTMLElement;

  let mode: "work" | "personal" = "work";

  const mic = createMicWatcher({
    onLevel: (level) => {
      const pct = Math.round(level * 100);
      voiceLevel.style.width = `${pct}%`;
      voiceMeter.setAttribute("aria-valuenow", String(pct));
    },
    onSpeak: () => {
      window.dispatchEvent(new CustomEvent("ragi:pulse"));
    },
  });

  function addChat(who: "you" | "ragi", text: string) {
    const div = document.createElement("div");
    div.className = `line ${who}`;
    const name = document.createElement("span");
    name.className = "who";
    name.textContent = who === "you" ? "You" : "RAGI";
    const body = document.createElement("p");
    body.textContent = text;
    div.append(name, body);
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function refresh() {
    try {
      const [m, b] = await Promise.all([getMode(), getBriefing()]);
      mode = m.mode === "personal" ? "personal" : "work";
      root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode));
      });
      briefingLine.textContent = b.briefing.summary || "Ready when you are.";
    } catch (err) {
      briefingLine.textContent =
        err instanceof ApiError ? err.message : "Could not load your brief yet. You can still ask below.";
    }
  }

  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.mode === "personal" ? "personal" : "work";
      void setMode(next)
        .then(async () => {
          mode = next;
          await refresh();
        })
        .catch((err) => {
          say(root, err instanceof ApiError ? err.message : "Could not switch mode.", "bad");
        });
    });
  });

  micBtn.addEventListener("click", () => {
    if (mic.active()) {
      mic.stop();
      micBtn.classList.remove("is-hot");
      micBtn.textContent = "Talk";
      micBtn.setAttribute("aria-pressed", "false");
      return;
    }
    void mic.start().then(
      () => {
        micBtn.classList.add("is-hot");
        micBtn.textContent = "Listening…";
        micBtn.setAttribute("aria-pressed", "true");
      },
      () => say(root, "Microphone permission is needed for Talk.", "bad"),
    );
  });

  root.querySelector("#castForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = chatIn.value.trim();
    if (!text) return;
    chatIn.value = "";
    addChat("you", text);
    say(root, "Thinking…", "");
    void chatAi(text, mode)
      .then((res) => {
        addChat("ragi", res.reply || "Done.");
        say(root, "", "");
      })
      .catch((err) => {
        say(root, err instanceof ApiError ? err.message : "RAGI could not answer.", "bad");
      });
  });

  void refresh();
  addChat("ragi", "Hi — ask me about your day, work, money, or schedule.");

  return () => {
    mic.stop();
  };
}
