import { API_ORIGIN } from "../api/client";

export type Room = "vault" | "hall" | "den" | "void";

export function renderShell(root: HTMLElement) {
  root.innerHTML = `
    <div class="title-bar">
      <h1>RAGI // DARK AGE OS</h1>
      <div class="title-meta">
        <span class="api-pill" id="apiPill">API …</span>
        <div class="hp" id="hpLine">HP 14/14 · LV1 OWNER</div>
      </div>
    </div>

    <nav class="nav-cryptic" aria-label="Cryptic rooms">
      <button type="button" data-room="vault" class="is-here">N-14 VAULT</button>
      <button type="button" data-room="hall" disabled>W-02 HALL</button>
      <button type="button" data-room="den" disabled>E-77 DEN</button>
      <button type="button" data-room="void">S-00 VOID</button>
    </nav>

    <div class="frame">
      <section id="roomVault" class="view is-on"></section>
      <section id="roomHall" class="view"></section>
      <section id="roomDen" class="view">
        <p class="prompt">&gt; DEN <span class="blink">_</span></p>
        <p class="lore">Side archive for sealed notes. Sparse on purpose.</p>
        <div class="stat-box">
          <h3>LEDGER</h3>
          <ul class="jobs" id="noteList"><li><span>locked until hall opens</span><span>—</span></li></ul>
          <div class="job-form">
            <input id="noteTitle" placeholder="note title" />
            <input id="noteBody" placeholder="body" />
            <button type="button" id="noteAdd">INSCRIBE</button>
          </div>
        </div>
        <p class="hint">API ORIGIN :: ${API_ORIGIN}</p>
      </section>
      <div class="dead-end" id="voidMsg">
        S-00 VOID // YOU WANDERED INTO NOTHING.<br />
        CLICK N-14 VAULT TO CRAWL BACK.
      </div>
    </div>
  `;

  return {
    vault: root.querySelector("#roomVault") as HTMLElement,
    hall: root.querySelector("#roomHall") as HTMLElement,
    den: root.querySelector("#roomDen") as HTMLElement,
    voidMsg: root.querySelector("#voidMsg") as HTMLElement,
    apiPill: root.querySelector("#apiPill") as HTMLElement,
    hpLine: root.querySelector("#hpLine") as HTMLElement,
    navButtons: [...root.querySelectorAll<HTMLButtonElement>(".nav-cryptic button")],
  };
}

export function setApiPill(el: HTMLElement, ok: boolean) {
  el.textContent = ok ? `API OK · ${API_ORIGIN}` : `API DOWN · ${API_ORIGIN}`;
  el.classList.toggle("ok", ok);
  el.classList.toggle("bad", !ok);
}

export function goRoom(
  room: Room,
  parts: ReturnType<typeof renderShell>,
  unlocked: boolean,
) {
  parts.voidMsg.classList.remove("is-on");
  parts.vault.classList.remove("is-on");
  parts.hall.classList.remove("is-on");
  parts.den.classList.remove("is-on");
  parts.navButtons.forEach((b) => b.classList.remove("is-here"));

  if (room === "void") {
    parts.voidMsg.classList.add("is-on");
    parts.navButtons.find((b) => b.dataset.room === "void")?.classList.add("is-here");
    return;
  }

  if ((room === "hall" || room === "den") && !unlocked) {
    parts.vault.classList.add("is-on");
    parts.navButtons.find((b) => b.dataset.room === "vault")?.classList.add("is-here");
    return;
  }

  const map = { vault: parts.vault, hall: parts.hall, den: parts.den } as const;
  map[room].classList.add("is-on");
  parts.navButtons.find((b) => b.dataset.room === room)?.classList.add("is-here");
}

export function unlockNav(parts: ReturnType<typeof renderShell>) {
  parts.navButtons.forEach((b) => {
    if (b.dataset.room === "hall" || b.dataset.room === "den") b.disabled = false;
  });
}
