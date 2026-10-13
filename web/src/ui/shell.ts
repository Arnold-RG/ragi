import { API_ORIGIN } from "../api/client";

export type Room =
  | "vault"
  | "hall"
  | "home"
  | "forge"
  | "gold"
  | "clock"
  | "hub"
  | "map"
  | "den"
  | "void";

const LOCKED: Room[] = ["hall", "home", "forge", "gold", "clock", "hub", "map", "den"];

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
      <button type="button" data-room="home" disabled>H-01 HOME</button>
      <button type="button" data-room="forge" disabled>F-33 FORGE</button>
      <button type="button" data-room="gold" disabled>G-55 GOLD</button>
      <button type="button" data-room="clock" disabled>C-88 CLOCK</button>
      <button type="button" data-room="hub" disabled>G-77 HUB</button>
      <button type="button" data-room="map" disabled>M-99 MAP</button>
      <button type="button" data-room="den" disabled>E-77 DEN</button>
      <button type="button" data-room="void">S-00 VOID</button>
    </nav>

    <div class="frame">
      <section id="roomVault" class="view is-on"></section>
      <section id="roomHall" class="view"></section>
      <section id="roomHome" class="view"></section>
      <section id="roomForge" class="view"></section>
      <section id="roomGold" class="view"></section>
      <section id="roomClock" class="view"></section>
      <section id="roomHub" class="view"></section>
      <section id="roomMap" class="view"></section>
      <section id="roomDen" class="view">
        <p class="prompt">&gt; E-77 DEN · VAULT MEMORY <span class="blink">_</span></p>
        <p class="lore">Notes plus durable storage. Snapshots are append-only — code edits never erase them.</p>
        <div class="dash-grid">
          <div class="stat-box">
            <h3>STORAGE BACKEND</h3>
            <div id="storeStatus" class="hint">loading…</div>
            <div class="job-form inline" style="margin-top:0.5rem">
              <button type="button" id="snapBtn">SEAL SNAPSHOT</button>
              <button type="button" id="exportBtn">EXPORT JSON</button>
            </div>
          </div>
          <div class="stat-box">
            <h3>MEMORY SNAPSHOTS</h3>
            <ul class="jobs" id="snapList"><li><span>none yet</span><span>—</span></li></ul>
          </div>
          <div class="stat-box wide">
            <h3>NOTE LEDGER</h3>
            <ul class="jobs" id="noteList"><li><span>locked until hall opens</span><span>—</span></li></ul>
            <div class="job-form">
              <input id="noteTitle" placeholder="note title" />
              <input id="noteBody" placeholder="body" />
              <button type="button" id="noteAdd">INSCRIBE</button>
            </div>
          </div>
        </div>
        <p class="hint">API ORIGIN :: ${API_ORIGIN} · RESTORE MERGES — NEVER WIPES SEALS</p>
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
    home: root.querySelector("#roomHome") as HTMLElement,
    forge: root.querySelector("#roomForge") as HTMLElement,
    gold: root.querySelector("#roomGold") as HTMLElement,
    clock: root.querySelector("#roomClock") as HTMLElement,
    hub: root.querySelector("#roomHub") as HTMLElement,
    map: root.querySelector("#roomMap") as HTMLElement,
    den: root.querySelector("#roomDen") as HTMLElement,
    voidMsg: root.querySelector("#voidMsg") as HTMLElement,
    apiPill: root.querySelector("#apiPill") as HTMLElement,
    hpLine: root.querySelector("#hpLine") as HTMLElement,
    navButtons: [...root.querySelectorAll<HTMLButtonElement>(".nav-cryptic button")],
  };
}

export type ShellParts = ReturnType<typeof renderShell>;

export function setApiPill(el: HTMLElement, ok: boolean) {
  el.textContent = ok ? `API OK · ${API_ORIGIN}` : `API DOWN · ${API_ORIGIN}`;
  el.classList.toggle("ok", ok);
  el.classList.toggle("bad", !ok);
}

export function goRoom(room: Room, parts: ShellParts, unlocked: boolean) {
  parts.voidMsg.classList.remove("is-on");
  const rooms: Array<keyof ShellParts> = [
    "vault",
    "hall",
    "home",
    "forge",
    "gold",
    "clock",
    "hub",
    "map",
    "den",
  ];
  rooms.forEach((k) => (parts[k] as HTMLElement).classList.remove("is-on"));
  parts.navButtons.forEach((b) => b.classList.remove("is-here"));

  if (room === "void") {
    parts.voidMsg.classList.add("is-on");
    parts.navButtons.find((b) => b.dataset.room === "void")?.classList.add("is-here");
    return;
  }

  if (LOCKED.includes(room) && !unlocked) {
    parts.vault.classList.add("is-on");
    parts.navButtons.find((b) => b.dataset.room === "vault")?.classList.add("is-here");
    return;
  }

  const el = parts[room] as HTMLElement;
  el.classList.add("is-on");
  parts.navButtons.find((b) => b.dataset.room === room)?.classList.add("is-here");
}

export function unlockNav(parts: ShellParts) {
  parts.navButtons.forEach((b) => {
    const room = b.dataset.room as Room;
    if (LOCKED.includes(room)) b.disabled = false;
  });
}

export function lockNav(parts: ShellParts) {
  parts.navButtons.forEach((b) => {
    const room = b.dataset.room as Room;
    if (LOCKED.includes(room)) b.disabled = true;
  });
}
