import { API_ORIGIN, pageCanReachApi } from "../api/client";

export type Room =
  | "vault"
  | "hall"
  | "home"
  | "forge"
  | "gold"
  | "clock"
  | "pulse"
  | "stage"
  | "hub"
  | "map"
  | "den"
  | "void";

const LOCKED: Room[] = ["hall", "home", "forge", "gold", "clock", "pulse", "stage", "hub", "map", "den"];

const TITLES: Record<Room, string> = {
  vault: "Sign in",
  hall: "Ask RAGI",
  home: "Today",
  forge: "Work",
  gold: "Money",
  clock: "Schedule",
  pulse: "Pulse",
  stage: "Motion",
  hub: "GitHub",
  map: "Progress",
  den: "Notes",
  void: "Sign out space",
};

const NAV: Array<{ room: Room; label: string; hint: string }> = [
  { room: "home", label: "Today", hint: "Day board" },
  { room: "hall", label: "Ask", hint: "Talk to RAGI" },
  { room: "forge", label: "Work", hint: "Projects & GitHub" },
  { room: "stage", label: "Motion", hint: "Scroll theater" },
  { room: "pulse", label: "Pulse", hint: "Focus studio" },
  { room: "gold", label: "Money", hint: "Cash flow" },
  { room: "clock", label: "Schedule", hint: "Calls & meetings" },
  { room: "den", label: "Notes", hint: "Private notes" },
];

function navButton(item: (typeof NAV)[number], opts?: { here?: boolean }) {
  return `<button type="button" data-room="${item.room}" class="app-nav-btn${opts?.here ? " is-here" : ""}"${
    opts?.here ? ' aria-current="page"' : ""
  } disabled>
      <span class="app-nav-label">${item.label}</span>
      <span class="app-nav-hint">${item.hint}</span>
    </button>`;
}

export function renderShell(root: HTMLElement) {
  document.body.classList.add("is-gate");
  root.classList.add("is-gate");

  root.innerHTML = `
    <a class="skip" href="#chamber">Skip to content</a>

    <header class="app-top">
      <div class="app-brand">
        <img class="app-logo" src="${import.meta.env.BASE_URL}logo.svg" width="36" height="36" alt="" />
        <div>
          <p class="app-kicker">Private secretary</p>
          <h1>RAGI</h1>
        </div>
      </div>
      <div class="app-top-meta">
        <time id="nowClock" class="now"></time>
        <p class="api-pill" id="apiPill" role="status">
          <span class="api-dot" aria-hidden="true"></span>
          <span class="api-copy">
            <span class="api-state">Checking</span>
            <span class="api-origin"></span>
          </span>
        </p>
        <p class="member-line" id="hpLine">Signed out</p>
        <button type="button" id="signOutBtn" class="ghost" hidden>Sign out</button>
      </div>
    </header>

    <div class="app-layout">
      <nav class="app-nav" aria-label="Main" hidden>
        ${NAV.map((item, i) => navButton(item, { here: i === 0 })).join("")}
      </nav>

      <main class="app-main" id="chamber" tabindex="-1">
        <section id="roomVault" class="view is-on"></section>
        <section id="roomHall" class="view" aria-label="Ask RAGI"></section>
        <section id="roomHome" class="view" aria-label="Today"></section>
        <section id="roomForge" class="view" aria-label="Work"></section>
        <section id="roomGold" class="view" aria-label="Money"></section>
        <section id="roomClock" class="view" aria-label="Schedule"></section>
        <section id="roomPulse" class="view" aria-label="Pulse"></section>
        <section id="roomStage" class="view" aria-label="Motion"></section>
        <section id="roomHub" class="view" aria-label="GitHub"></section>
        <section id="roomMap" class="view" aria-label="Progress" hidden></section>
        <section id="roomDen" class="view" aria-label="Notes">
          <header class="page-head">
            <h2 class="page-title" tabindex="-1">Notes</h2>
            <p class="page-sub">Ideas, people, and follow-ups — kept private to your account.</p>
          </header>
          <p class="msg" data-room-msg role="status"></p>
          <div class="board">
            <div class="two-col">
              <section class="board-section" style="border-top:0;padding-top:0">
                <div class="board-section-head">
                  <h3>Your notes</h3>
                  <p>Write freely</p>
                </div>
                <ul class="jobs" id="noteList"><li class="entry is-empty"><p class="entry-title">Sign in to read your notes.</p></li></ul>
                <form class="stack" id="noteForm" style="margin-top:1rem">
                  <label class="field"><span>Title</span><input id="noteTitle" name="title" autocomplete="off" maxlength="160" /></label>
                  <label class="field"><span>Note</span><textarea id="noteBody" name="body" maxlength="8000" rows="5"></textarea></label>
                  <button type="submit" id="noteAdd" class="primary">Save note</button>
                </form>
              </section>
              <section class="board-section" style="border-top:0;padding-top:0">
                <div class="board-section-head">
                  <h3>Account</h3>
                  <p>Password only</p>
                </div>
                <form class="stack" id="passwordForm">
                  <label class="field"><span>Current password</span><input id="pwCurrent" type="password" autocomplete="current-password" required minlength="1" maxlength="128" /></label>
                  <label class="field"><span>New password</span><input id="pwNew" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
                  <label class="field"><span>Confirm new password</span><input id="pwNew2" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
                  <button type="submit" class="primary">Update password</button>
                </form>
              </section>
            </div>
          </div>
        </section>
        <section class="dead-end" id="voidMsg" hidden></section>
      </main>
    </div>

    <footer class="colophon app-foot">
      <p>Arnova Group</p>
      <p>Your private secretary</p>
    </footer>
  `;

  return {
    vault: root.querySelector("#roomVault") as HTMLElement,
    hall: root.querySelector("#roomHall") as HTMLElement,
    home: root.querySelector("#roomHome") as HTMLElement,
    forge: root.querySelector("#roomForge") as HTMLElement,
    gold: root.querySelector("#roomGold") as HTMLElement,
    clock: root.querySelector("#roomClock") as HTMLElement,
    pulse: root.querySelector("#roomPulse") as HTMLElement,
    stage: root.querySelector("#roomStage") as HTMLElement,
    hub: root.querySelector("#roomHub") as HTMLElement,
    map: root.querySelector("#roomMap") as HTMLElement,
    den: root.querySelector("#roomDen") as HTMLElement,
    voidMsg: root.querySelector("#voidMsg") as HTMLElement,
    apiPill: root.querySelector("#apiPill") as HTMLElement,
    hpLine: root.querySelector("#hpLine") as HTMLElement,
    now: root.querySelector("#nowClock") as HTMLTimeElement,
    signOut: root.querySelector("#signOutBtn") as HTMLButtonElement,
    voidBack: root.querySelector("#voidBack") as HTMLButtonElement | null,
    nav: root.querySelector(".app-nav") as HTMLElement,
    navButtons: [...root.querySelectorAll<HTMLButtonElement>(".app-nav button")],
    root,
  };
}

export type ShellParts = ReturnType<typeof renderShell>;

export function setGateMode(parts: ShellParts, gate: boolean) {
  document.body.classList.toggle("is-gate", gate);
  document.body.classList.toggle("is-app", !gate);
  parts.root.classList.toggle("is-gate", gate);
  parts.root.classList.toggle("is-app", !gate);
  parts.nav.hidden = gate;
  const top = parts.root.querySelector(".app-top") as HTMLElement | null;
  if (top) top.hidden = gate;
  const foot = parts.root.querySelector(".app-foot") as HTMLElement | null;
  if (foot) foot.hidden = gate;
  if (gate) parts.signOut.hidden = true;
}

export function setApiPill(el: HTMLElement, ok: boolean) {
  const state = el.querySelector(".api-state");
  const origin = el.querySelector(".api-origin");
  const reachable = pageCanReachApi();
  if (!reachable) {
    if (state) state.textContent = "On this device";
    if (origin) origin.textContent = "Local vault active";
    el.classList.remove("bad");
    el.classList.add("ok");
    return;
  }
  if (state) state.textContent = ok ? "Connected" : "Offline";
  if (origin) origin.textContent = ok ? "Account server ready" : API_ORIGIN;
  el.classList.toggle("ok", ok);
  el.classList.toggle("bad", !ok);
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
    "pulse",
    "stage",
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
    el.classList.add("is-on");
    const button = parts.navButtons.find((item) => item.dataset.room === name);
    button?.classList.add("is-here");
    button?.setAttribute("aria-current", "page");
    document.title = `${TITLES[name]} — RAGI`;
    if (opts?.focus) {
      el.querySelector<HTMLElement>("h2")?.focus();
    }
  };

  if (room === "void") {
    show("home", parts.home);
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
    button.disabled = false;
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
