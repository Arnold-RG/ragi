import { API_ORIGIN, pageCanReachApi } from "../api/client";

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

const TITLES: Record<Room, string> = {
  vault: "Vault",
  hall: "Hall",
  home: "Home",
  forge: "Forge",
  gold: "Gold",
  clock: "Clock",
  hub: "Hub",
  map: "Map",
  den: "Den",
  void: "Void",
};

function roomButton(room: Room, code: string, name: string, opts?: { here?: boolean; open?: boolean }) {
  const locked = !opts?.open && LOCKED.includes(room);
  return `<button type="button" data-room="${room}" class="${opts?.here ? "is-here" : ""}"${
    opts?.here ? ' aria-current="page"' : ""
  }${locked ? " disabled" : ""}>
      <span class="room-code">${code}</span>
      <span class="room-name">${name}</span>
      ${locked ? '<span class="room-lock">Locked</span>' : ""}
    </button>`;
}

export function renderShell(root: HTMLElement) {
  document.body.classList.add("is-gate");
  root.classList.add("is-gate");

  root.innerHTML = `
    <a class="skip" href="#chamber">Skip to the room</a>
    <header class="mast">
      <div class="brand">
        <p class="eyebrow">Arnova · sealed vault</p>
        <h1>RAGI</h1>
      </div>
      <div class="mast-meta">
        <time id="nowClock" class="now"></time>
        <p class="api-pill" id="apiPill" role="status">
          <span class="api-dot" aria-hidden="true"></span>
          <span class="api-copy">
            <span class="api-state">Checking link</span>
            <span class="api-origin"></span>
          </span>
        </p>
        <p class="member-line" id="hpLine">Signed out</p>
        <button type="button" id="signOutBtn" class="ghost" hidden>Sign out</button>
      </div>
    </header>

    <div class="workspace">
      <nav class="rooms" aria-label="Rooms" hidden>
        ${roomButton("vault", "N-14", "Vault", { open: true })}
        ${roomButton("hall", "W-02", "Hall", { here: true })}
        ${roomButton("home", "H-01", "Home")}
        ${roomButton("forge", "F-33", "Forge")}
        ${roomButton("gold", "G-55", "Gold")}
        ${roomButton("clock", "C-88", "Clock")}
        ${roomButton("hub", "G-77", "Hub")}
        ${roomButton("map", "M-99", "Map")}
        ${roomButton("den", "E-77", "Den")}
        ${roomButton("void", "S-00", "Void", { open: true })}
      </nav>

      <main class="frame" id="chamber" tabindex="-1">
        <section id="roomVault" class="view is-on"></section>
        <section id="roomHall" class="view" aria-label="Hall"></section>
        <section id="roomHome" class="view" aria-label="Home"></section>
        <section id="roomForge" class="view" aria-label="Forge"></section>
        <section id="roomGold" class="view" aria-label="Gold"></section>
        <section id="roomClock" class="view" aria-label="Clock"></section>
        <section id="roomHub" class="view" aria-label="Hub"></section>
        <section id="roomMap" class="view" aria-label="Map"></section>
        <section id="roomDen" class="view" aria-label="Den">
          <header class="room-head">
            <p class="room-index">E-77</p>
            <h2 class="prompt" tabindex="-1">Den</h2>
          </header>
          <p class="lore">Notes live with your vault. A snapshot is an append-only copy of your account only. Restoring one merges it back.</p>
          <p class="msg" data-room-msg role="status"></p>
          <div class="dash-grid">
            <section class="stat-box">
              <h3>Storage</h3>
              <div id="storeStatus" class="quiet">Loading the ledger…</div>
              <div class="form-actions">
                <button type="button" id="snapBtn" class="primary">Seal a snapshot</button>
                <button type="button" id="exportBtn" class="ghost">Export JSON</button>
              </div>
            </section>
            <section class="stat-box">
              <h3>Snapshots</h3>
              <ul class="jobs" id="snapList"><li class="entry is-empty"><p class="entry-title">None yet.</p></li></ul>
            </section>
            <section class="stat-box wide">
              <h3>Notes</h3>
              <ul class="jobs" id="noteList"><li class="entry is-empty"><p class="entry-title">Sign in to read your notes.</p></li></ul>
              <form class="stack" id="noteForm">
                <label class="field"><span>Title</span><input id="noteTitle" name="title" autocomplete="off" maxlength="160" /></label>
                <label class="field"><span>Note</span><textarea id="noteBody" name="body" maxlength="8000"></textarea></label>
                <button type="submit" id="noteAdd" class="primary">Inscribe</button>
              </form>
            </section>
            <section class="stat-box wide">
              <h3>Change password</h3>
              <p class="hint">Use this when you still know the current password. Forgot? Use the vault Forgot tab with your recovery key.</p>
              <form class="stack" id="passwordForm">
                <label class="field"><span>Current password</span><input id="pwCurrent" type="password" autocomplete="current-password" required minlength="1" maxlength="128" /></label>
                <label class="field"><span>New password</span><input id="pwNew" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
                <label class="field"><span>Confirm new password</span><input id="pwNew2" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
                <button type="submit" class="primary">Update password</button>
              </form>
            </section>
          </div>
          <p class="hint">A restore merges into this account only.</p>
        </section>
        <section class="dead-end" id="voidMsg">
          <header class="room-head">
            <p class="room-index">S-00</p>
            <h2 class="prompt" tabindex="-1">Void</h2>
          </header>
          <p class="lore">Nothing is stored in this room. When you want the door again, return to the vault.</p>
          <button type="button" id="voidBack" class="primary">Back to the vault</button>
        </section>
      </main>
    </div>
    <footer class="colophon">
      <p>Arnova Group · Arnold-RG</p>
      <p>3D vault · encrypted session · your account alone</p>
    </footer>
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
    now: root.querySelector("#nowClock") as HTMLTimeElement,
    signOut: root.querySelector("#signOutBtn") as HTMLButtonElement,
    voidBack: root.querySelector("#voidBack") as HTMLButtonElement,
    nav: root.querySelector(".rooms") as HTMLElement,
    navButtons: [...root.querySelectorAll<HTMLButtonElement>(".rooms button")],
    root,
  };
}

export type ShellParts = ReturnType<typeof renderShell>;

export function setGateMode(parts: ShellParts, gate: boolean) {
  document.body.classList.toggle("is-gate", gate);
  parts.root.classList.toggle("is-gate", gate);
  parts.nav.hidden = gate;
  if (gate) {
    parts.signOut.hidden = true;
  }
}

export function setApiPill(el: HTMLElement, ok: boolean) {
  const state = el.querySelector(".api-state");
  const origin = el.querySelector(".api-origin");
  const reachable = pageCanReachApi();
  if (!reachable) {
    if (state) state.textContent = "Device vault";
    if (origin) origin.textContent = "Accounts seal on this browser. API optional.";
    el.classList.remove("bad");
    el.classList.add("ok");
    el.title = "Encrypted local accounts are active. Connect VITE_API_ORIGIN for the full server vault.";
    return;
  }
  if (state) state.textContent = ok ? "Vault link up" : "Vault link down";
  if (origin) origin.textContent = API_ORIGIN;
  el.classList.toggle("ok", ok);
  el.classList.toggle("bad", !ok);
  el.title = ok ? `Answering at ${API_ORIGIN}` : `No answer from ${API_ORIGIN}`;
}

export function goRoom(room: Room, parts: ShellParts, unlocked: boolean, opts?: { focus?: boolean }) {
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
  rooms.forEach((key) => (parts[key] as HTMLElement).classList.remove("is-on"));
  parts.navButtons.forEach((button) => {
    button.classList.remove("is-here");
    button.removeAttribute("aria-current");
  });

  const show = (name: Room, el: HTMLElement) => {
    if (name !== "void") el.classList.add("is-on");
    const button = parts.navButtons.find((item) => item.dataset.room === name);
    button?.classList.add("is-here");
    button?.setAttribute("aria-current", "page");
    document.title = `${TITLES[name]} — RAGI`;
    if (opts?.focus) {
      const heading = (name === "void" ? parts.voidMsg : el).querySelector<HTMLElement>("h2");
      heading?.focus();
    }
  };

  if (room === "void") {
    parts.voidMsg.classList.add("is-on");
    show("void", parts.voidMsg);
    return;
  }

  if (LOCKED.includes(room) && !unlocked) {
    show("vault", parts.vault);
    return;
  }

  show(room, parts[room] as HTMLElement);
}

export function unlockNav(parts: ShellParts) {
  setGateMode(parts, false);
  parts.nav.classList.add("is-open");
  parts.signOut.hidden = false;
  parts.navButtons.forEach((button) => {
    const room = button.dataset.room as Room;
    if (LOCKED.includes(room)) button.disabled = false;
  });
}

export function lockNav(parts: ShellParts) {
  setGateMode(parts, true);
  parts.nav.classList.remove("is-open");
  parts.signOut.hidden = true;
  parts.navButtons.forEach((button) => {
    const room = button.dataset.room as Room;
    if (LOCKED.includes(room)) button.disabled = true;
  });
}
