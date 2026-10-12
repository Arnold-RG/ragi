import { gate1, gate2, gate3, startChallenge } from "../api/auth";
import { ApiError } from "../api/client";
import { setToken } from "../state/session";

export function renderUnlock(root: HTMLElement, onUnlocked: () => void) {
  root.innerHTML = `
    <p class="prompt">&gt; ENTER TRIPLE SEAL <span class="blink">_</span></p>
    <p class="lore">
      Owner vault. Three permissions bind the secretary. Live wardens wait in the hall.
      Wrong order dies. Wrong door is the void.
    </p>
    <div class="gate-map">
      <div class="mini-map" id="miniMap" aria-hidden="true"></div>
      <div class="gate-list">
        <div class="gate-row is-active" data-step="1">
          <code>SIGIL</code>
          <input id="gate1" type="password" autocomplete="off" spellcheck="false" placeholder="passphrase rune" />
          <button type="button" data-check="1">SET</button>
        </div>
        <div class="gate-row" data-step="2">
          <code>HEX</code>
          <input id="gate2" type="text" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="owner code / totp" />
          <button type="button" data-check="2">SET</button>
        </div>
        <div class="gate-row" data-step="3">
          <code>RELIC</code>
          <input id="gate3" type="password" autocomplete="off" spellcheck="false" placeholder="device relic" />
          <button type="button" data-check="3">SET</button>
        </div>
        <p class="msg" id="lockMsg"></p>
      </div>
    </div>
    <p class="hint">SEALS HIT THE LIVE BACKEND · DIGESTS NEVER TRAVEL IN THE CLEAR FROM THE SERVER STORE</p>
  `;

  const map = root.querySelector("#miniMap") as HTMLElement;
  for (let i = 0; i < 28; i++) {
    const c = document.createElement("div");
    c.className = "cell";
    c.style.left = `${8 + (i % 7) * 16}px`;
    c.style.top = `${12 + Math.floor(i / 7) * 22}px`;
    if (i === 3 || i === 10 || i === 17 || i === 24) c.style.background = "#000";
    map.appendChild(c);
  }
  const you = document.createElement("div");
  you.className = "you";
  you.style.left = "40px";
  you.style.top = "56px";
  map.appendChild(you);

  let challengeId = "";
  let step = 1;
  const msg = root.querySelector("#lockMsg") as HTMLElement;

  function setStep(n: number) {
    step = n;
    root.querySelectorAll(".gate-row").forEach((el) => {
      const s = Number((el as HTMLElement).dataset.step);
      el.classList.toggle("is-active", s === n);
      el.classList.toggle("is-cleared", s < n);
    });
    you.style.left = `${24 + (n - 1) * 28}px`;
  }

  async function ensureChallenge() {
    if (challengeId) return;
    const c = await startChallenge();
    challengeId = c.challengeId;
  }

  root.querySelectorAll<HTMLButtonElement>("[data-check]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const n = Number(btn.dataset.check);
      if (n !== step) {
        msg.textContent = "WRONG ORDER // OLD RULES";
        msg.className = "msg bad";
        return;
      }
      const input = root.querySelector(`#gate${n}`) as HTMLInputElement;
      msg.textContent = "SEALING…";
      msg.className = "msg";
      try {
        await ensureChallenge();
        if (n === 1) await gate1(challengeId, input.value.trim());
        if (n === 2) await gate2(challengeId, input.value.trim());
        if (n === 3) {
          const session = await gate3(challengeId, input.value.trim());
          setToken(session.token);
        }
        msg.textContent = `SEAL ${n} ACCEPTED`;
        msg.className = "msg good";
        input.disabled = true;
        btn.disabled = true;
        if (n < 3) {
          setStep(n + 1);
          (root.querySelector(`#gate${n + 1}`) as HTMLInputElement).focus();
        } else {
          root.querySelectorAll(".gate-row").forEach((el) => {
            el.classList.add("is-cleared");
            el.classList.remove("is-active");
          });
          onUnlocked();
        }
      } catch (err) {
        const label = err instanceof ApiError ? err.message : "seal_failed";
        msg.textContent = `SEAL REJECTED :: ${label}`;
        msg.className = "msg bad";
      }
    });
  });

  ["gate1", "gate2", "gate3"].forEach((id) => {
    root.querySelector(`#${id}`)?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        const n = Number(id.replace("gate", ""));
        root.querySelector<HTMLButtonElement>(`[data-check="${n}"]`)?.click();
      }
    });
  });
}
