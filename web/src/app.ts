import { pingHealth } from "./api/client";
import { logout, me } from "./api/auth";
import { createNote, listNotes } from "./api/secretary";
import {
  exportVault,
  listSnapshots,
  restoreSnapshot,
  storageStatus,
  takeSnapshot,
} from "./api/storage";
import { isUnlocked, clearSession } from "./state/session";
import { goRoom, lockNav, renderShell, setApiPill, setGateMode, unlockNav, type Room } from "./ui/shell";
import { renderUnlock } from "./ui/unlock";
import { renderChamber } from "./ui/chamber";
import { renderClock, renderForge, renderGold, renderHome, renderHub, renderMap } from "./ui/rooms";
import { deleteNote, patchNote } from "./api/life";
import { ApiError } from "./api/client";
import { guard, openRowEditor, say } from "./ui/dom";

type NoteRow = { id: string; title: string; body: string };

export async function startApp(root: HTMLElement) {
  const shell = renderShell(root);
  let unlocked = isUnlocked();
  let disposeChamber: (() => void) | null = null;
  let notesById = new Map<string, NoteRow>();

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
    const storeStatus = shell.den.querySelector("#storeStatus");
    const snapList = shell.den.querySelector("#snapList");
    if (!list || !storeStatus || !snapList) return;

    try {
      const res = await listNotes();
      notesById = new Map(res.notes.map((n) => [n.id, n]));
      list.replaceChildren();
      if (!res.notes.length) {
        const empty = document.createElement("li");
        empty.className = "entry is-empty";
        empty.innerHTML = `<p class="entry-title">No notes yet.</p>`;
        list.append(empty);
      } else {
        for (const note of res.notes.slice(0, 8)) {
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
            if (!window.confirm("Archive this note? A snapshot is sealed first.")) return;
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
      li.innerHTML = `<p class="entry-title">The ledger is unreachable.</p>`;
      list.append(li);
    }

    try {
      const st = await storageStatus();
      const latest = st.latestSnapshot
        ? `${st.latestSnapshot.id} · ${new Date(st.latestSnapshot.createdAt).toLocaleString()}`
        : "None yet";
      storeStatus.replaceChildren();
      const lines = [
        `Engine ${st.engine}`,
        `Durable ${st.durable ? "yes" : "no"}`,
        `Snapshots ${st.snapshotCount}`,
        `Latest ${latest}`,
        st.note,
      ];
      for (const line of lines) {
        const p = document.createElement("p");
        p.textContent = line;
        storeStatus.append(p);
      }
      const snaps = await listSnapshots();
      snapList.replaceChildren();
      if (!snaps.snapshots.length) {
        const li = document.createElement("li");
        li.className = "entry is-empty";
        li.innerHTML = `<p class="entry-title">No snapshots yet.</p>`;
        snapList.append(li);
      } else {
        for (const snap of snaps.snapshots.slice(0, 8)) {
          const li = document.createElement("li");
          li.className = "entry";
          const copy = document.createElement("div");
          copy.className = "entry-copy";
          const title = document.createElement("p");
          title.className = "entry-title";
          title.textContent = snap.id;
          const meta = document.createElement("p");
          meta.className = "entry-meta";
          meta.textContent = `${Math.round(snap.bytes / 1024)} kb`;
          copy.append(title, meta);
          const acts = document.createElement("div");
          acts.className = "acts";
          const merge = document.createElement("button");
          merge.type = "button";
          merge.className = "ghost";
          merge.textContent = "Merge";
          merge.addEventListener("click", () => {
            merge.disabled = true;
            merge.textContent = "Merging";
            void restoreSnapshot(snap.id)
              .then(async (result) => {
                merge.textContent = `+${result.added}`;
                await refreshDen();
              })
              .catch(() => {
                merge.textContent = "Failed";
                merge.disabled = false;
              });
          });
          acts.append(merge);
          li.append(copy, acts);
          snapList.append(li);
        }
      }
    } catch {
      storeStatus.textContent = "Storage is unreachable.";
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
      say(shell.den, "Note inscribed.", "good");
      await refreshDen();
    });
  });

  shell.den.querySelector("#snapBtn")?.addEventListener("click", () => {
    if (!unlocked) return;
    void guard(shell.den, async () => {
      await takeSnapshot("manual-ui");
      say(shell.den, "Snapshot sealed.", "good");
      await refreshDen();
    });
  });

  shell.den.querySelector("#exportBtn")?.addEventListener("click", () => {
    if (!unlocked) return;
    void guard(shell.den, async () => {
      const data = await exportVault();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ragi-vault-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  async function paintRoom(room: Room) {
    if (!unlocked) return;
    if (room === "home") await renderHome(shell.home);
    if (room === "forge") await renderForge(shell.forge);
    if (room === "gold") await renderGold(shell.gold);
    if (room === "clock") await renderClock(shell.clock);
    if (room === "hub") await renderHub(shell.hub);
    if (room === "map") await renderMap(shell.map);
    if (room === "den") await refreshDen();
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

  async function enterHall() {
    unlocked = true;
    unlockNav(shell);
    goRoom("hall", shell, unlocked);
    disposeChamber?.();
    disposeChamber = await renderChamber(shell.hall, () => {
      unlocked = false;
      disposeChamber = null;
      lockNav(shell);
      shell.hpLine.textContent = "Signed out";
      bootVault();
      goRoom("vault", shell, false);
    });
    await refreshDen();
    try {
      const profile = await me();
      const mode = profile.mode === "personal" ? "personal" : "work";
      shell.hpLine.textContent = `${profile.handle} · ${mode}`;
    } catch {
      shell.hpLine.textContent = "Session weak";
    }
  }

  function bootVault() {
    setGateMode(shell, true);
    renderUnlock(shell.vault, () => {
      void enterHall();
    });
  }

  bootVault();

  if (unlocked) {
    try {
      await me();
      await enterHall();
    } catch {
      clearSession();
      unlocked = false;
      lockNav(shell);
    }
  }

  shell.signOut.addEventListener("click", () => {
    void leave();
  });

  shell.voidBack.addEventListener("click", () => {
    goRoom("vault", shell, unlocked, { focus: true });
  });

  shell.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const room = btn.dataset.room as Room;
      if (room !== "vault" && room !== "void" && !unlocked) {
        say(shell.vault, "That room opens after you sign in.", "bad");
        goRoom("vault", shell, unlocked);
        return;
      }
      goRoom(room, shell, unlocked, { focus: true });
      void paintRoom(room);
    });
  });

  window.setInterval(() => {
    if (document.hidden) return;
    void pingHealth().then((ok) => setApiPill(shell.apiPill, ok));
  }, 20000);
}
