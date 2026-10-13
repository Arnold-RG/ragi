import { pingHealth } from "./api/client";
import { changePassword, logout, me } from "./api/auth";
import { createNote, listNotes } from "./api/secretary";
import { isUnlocked, clearSession, getSessionMeta } from "./state/session";
import { goRoom, lockNav, renderShell, setApiPill, setGateMode, unlockNav, type Room } from "./ui/shell";
import { renderUnlock } from "./ui/unlock";
import { renderChamber } from "./ui/chamber";
import { renderClock, renderForge, renderGold, renderHome, renderHub, renderMap } from "./ui/rooms";
import { renderPulse } from "./ui/pulse";
import { deleteNote, patchNote } from "./api/life";
import { ApiError } from "./api/client";
import { guard, openRowEditor, say } from "./ui/dom";
import { animateAppChrome, animateRoom, animateVault, type MotionHandle } from "./motion/ragiMotion";

type NoteRow = { id: string; title: string; body: string };

export async function startApp(root: HTMLElement) {
  const shell = renderShell(root);
  let unlocked = isUnlocked();
  let disposeChamber: (() => void) | null = null;
  let disposePulse: (() => void) | null = null;
  let roomMotion: MotionHandle | null = null;
  let vaultMotion: MotionHandle | null = null;
  let notesById = new Map<string, NoteRow>();

  function playRoomMotion(target: HTMLElement) {
    roomMotion?.dispose();
    roomMotion = animateRoom(target);
  }

  window.addEventListener("ragi:motion", ((event: CustomEvent<{ root?: HTMLElement }>) => {
    const el = event.detail?.root;
    if (el) playRoomMotion(el);
  }) as EventListener);

  const healthy = await pingHealth();
  setApiPill(shell.apiPill, healthy);

  function paintClock() {
    const now = new Date();
    shell.now.dateTime = now.toISOString();
    shell.now.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  }
  paintClock();
  const clockDelay = 60_000 - (Date.now() % 60_000) + 200;
  window.setTimeout(() => {
    paintClock();
    window.setInterval(paintClock, 60_000);
  }, clockDelay);

  async function refreshDen() {
    if (!unlocked) return;
    const list = shell.den.querySelector("#noteList");
    if (!list) return;

    try {
      const res = await listNotes();
      notesById = new Map(res.notes.map((n) => [n.id, n]));
      list.replaceChildren();
      if (!res.notes.length) {
        const empty = document.createElement("li");
        empty.className = "entry is-empty";
        empty.innerHTML = `<p class="entry-title">No notes yet — write one below.</p>`;
        list.append(empty);
      } else {
        for (const note of res.notes.slice(0, 40)) {
          const li = document.createElement("li");
          li.className = "entry";
          const copy = document.createElement("div");
          copy.className = "entry-copy";
          const title = document.createElement("p");
          title.className = "entry-title";
          title.textContent = note.title;
          const body = document.createElement("p");
          body.className = "entry-note";
          body.textContent = note.body;
          copy.append(title, body);
          const acts = document.createElement("div");
          acts.className = "acts";
          const edit = document.createElement("button");
          edit.type = "button";
          edit.className = "ghost";
          edit.textContent = "Edit";
          edit.addEventListener("click", () => {
            const current = notesById.get(note.id);
            if (!current) return;
            openRowEditor(
              li,
              [
                { name: "title", label: "Title", value: current.title },
                { name: "body", label: "Note", value: current.body, multiline: true },
              ],
              async (values) => {
                if (!values.title) throw new ApiError(400, { message: "A note needs a title." });
                await patchNote(note.id, { title: values.title, body: values.body });
                await refreshDen();
              },
              () => void refreshDen(),
            );
          });
          const del = document.createElement("button");
          del.type = "button";
          del.className = "ghost";
          del.textContent = "Archive";
          del.addEventListener("click", () => {
            if (!window.confirm("Archive this note?")) return;
            void guard(shell.den, async () => {
              await deleteNote(note.id);
              await refreshDen();
            });
          });
          acts.append(edit, del);
          li.append(copy, acts);
          list.append(li);
        }
      }
    } catch {
      list.replaceChildren();
      const li = document.createElement("li");
      li.className = "entry is-empty";
      li.innerHTML = `<p class="entry-title">Notes are unreachable right now.</p>`;
      list.append(li);
    }
  }

  shell.den.querySelector("#noteForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!unlocked) return;
    const title = (shell.den.querySelector("#noteTitle") as HTMLInputElement).value.trim();
    const body = (shell.den.querySelector("#noteBody") as HTMLTextAreaElement).value.trim();
    if (!title) return say(shell.den, "A note needs a title.", "bad");
    void guard(shell.den, async () => {
      await createNote({ title, body, kind: "note" });
      (shell.den.querySelector("#noteTitle") as HTMLInputElement).value = "";
      (shell.den.querySelector("#noteBody") as HTMLTextAreaElement).value = "";
      say(shell.den, "Note saved.", "good");
      await refreshDen();
    });
  });

  shell.den.querySelector("#passwordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!unlocked) return;
    const currentPassword = (shell.den.querySelector("#pwCurrent") as HTMLInputElement).value;
    const newPassword = (shell.den.querySelector("#pwNew") as HTMLInputElement).value;
    const confirm = (shell.den.querySelector("#pwNew2") as HTMLInputElement).value;
    if (newPassword !== confirm) {
      say(shell.den, "The two new passwords do not match.", "bad");
      return;
    }
    void guard(shell.den, async () => {
      await changePassword({ currentPassword, newPassword });
      (shell.den.querySelector("#pwCurrent") as HTMLInputElement).value = "";
      (shell.den.querySelector("#pwNew") as HTMLInputElement).value = "";
      (shell.den.querySelector("#pwNew2") as HTMLInputElement).value = "";
      say(shell.den, "Password updated.", "good");
    });
  });

  async function paintRoom(room: Room) {
    if (!unlocked) return;
    disposePulse?.();
    disposePulse = null;
    let stage: HTMLElement | null = null;
    if (room === "home") {
      await renderHome(shell.home);
      stage = shell.home;
    }
    if (room === "forge") {
      await renderForge(shell.forge);
      stage = shell.forge;
    }
    if (room === "gold") {
      await renderGold(shell.gold);
      stage = shell.gold;
    }
    if (room === "clock") {
      await renderClock(shell.clock);
      stage = shell.clock;
    }
    if (room === "pulse") {
      disposePulse = await renderPulse(shell.pulse);
      /* motion triggered from pulse paint via ragi:motion */
    }
    if (room === "hub") {
      await renderHub(shell.hub);
      stage = shell.hub;
    }
    if (room === "map") {
      await renderMap(shell.map);
      stage = shell.map;
    }
    if (room === "den") {
      await refreshDen();
      stage = shell.den;
    }
    if (room === "hall") stage = shell.hall;
    if (stage) playRoomMotion(stage);
  }

  async function leave() {
    try {
      await logout();
    } catch {
      /* local session still ends */
    }
    disposeChamber?.();
    disposeChamber = null;
    clearSession();
    unlocked = false;
    lockNav(shell);
    shell.hpLine.textContent = "Signed out";
    bootVault();
    goRoom("vault", shell, false);
  }

  async function enterApp() {
    unlocked = true;
    unlockNav(shell);
    vaultMotion?.dispose();
    vaultMotion = null;
    animateAppChrome(shell.root);
    goRoom("home", shell, unlocked);
    disposeChamber?.();
    disposeChamber = await renderChamber(shell.hall, () => {
      unlocked = false;
      disposeChamber = null;
      lockNav(shell);
      shell.hpLine.textContent = "Signed out";
      bootVault();
      goRoom("vault", shell, false);
    });
    await paintRoom("home");
    await refreshDen();
    try {
      const profile = await me();
      shell.hpLine.textContent = profile.handle;
    } catch {
      const meta = getSessionMeta();
      shell.hpLine.textContent = meta?.handle ?? "Signed in";
    }
  }

  function bootVault() {
    setGateMode(shell, true);
    renderUnlock(shell.vault, () => {
      void enterApp();
    });
    vaultMotion?.dispose();
    vaultMotion = animateVault(shell.vault);
  }

  bootVault();

  if (unlocked) {
    try {
      await me();
      await enterApp();
    } catch {
      clearSession();
      unlocked = false;
      lockNav(shell);
    }
  }

  shell.signOut.addEventListener("click", () => {
    void leave();
  });

  shell.voidBack?.addEventListener("click", () => {
    goRoom("home", shell, unlocked, { focus: true });
  });

  shell.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const room = btn.dataset.room as Room;
      if (!unlocked) {
        say(shell.vault, "Sign in first.", "bad");
        goRoom("vault", shell, unlocked);
        return;
      }
      goRoom(room, shell, unlocked, { focus: true });
      void paintRoom(room);
    });
  });

  window.addEventListener("ragi:goto", ((event: CustomEvent<{ room?: Room }>) => {
    const room = event.detail?.room;
    if (!room || !unlocked) return;
    goRoom(room, shell, unlocked, { focus: true });
    void paintRoom(room);
  }) as EventListener);

  window.setInterval(() => {
    if (document.hidden) return;
    void pingHealth().then((ok) => setApiPill(shell.apiPill, ok));
  }, 20000);
}
