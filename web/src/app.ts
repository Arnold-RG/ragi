import { pingHealth } from "./api/client";
import { me } from "./api/auth";
import { createNote, listNotes } from "./api/secretary";
import { isUnlocked, clearSession } from "./state/session";
import { goRoom, renderShell, setApiPill, unlockNav, lockNav, type Room } from "./ui/shell";
import { renderUnlock } from "./ui/unlock";
import { renderChamber } from "./ui/chamber";
import { renderClock, renderForge, renderGold, renderHome, renderMap } from "./ui/rooms";

export async function startApp(root: HTMLElement) {
  const shell = renderShell(root);
  let unlocked = isUnlocked();
  let disposeChamber: (() => void) | null = null;

  const healthy = await pingHealth();
  setApiPill(shell.apiPill, healthy);

  async function refreshDen() {
    const list = shell.den.querySelector("#noteList") as HTMLElement | null;
    if (!list || !unlocked) return;
    try {
      const res = await listNotes();
      list.innerHTML = res.notes.length
        ? res.notes
            .slice(0, 8)
            .map((n) => `<li><span>${n.title}</span><span>${n.kind}</span></li>`)
            .join("")
        : `<li><span>empty ledger</span><span>—</span></li>`;
    } catch {
      list.innerHTML = `<li><span>ledger unreachable</span><span>!</span></li>`;
    }
  }

  shell.den.querySelector("#noteAdd")?.addEventListener("click", async () => {
    if (!unlocked) return;
    const title = (shell.den.querySelector("#noteTitle") as HTMLInputElement).value.trim();
    const body = (shell.den.querySelector("#noteBody") as HTMLInputElement).value.trim();
    if (!title) return;
    await createNote({ title, body, kind: "note" });
    (shell.den.querySelector("#noteTitle") as HTMLInputElement).value = "";
    (shell.den.querySelector("#noteBody") as HTMLInputElement).value = "";
    await refreshDen();
  });

  async function paintRoom(room: Room) {
    if (!unlocked) return;
    if (room === "home") await renderHome(shell.home);
    if (room === "forge") await renderForge(shell.forge);
    if (room === "gold") await renderGold(shell.gold);
    if (room === "clock") await renderClock(shell.clock);
    if (room === "map") await renderMap(shell.map);
    if (room === "den") await refreshDen();
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
      bootVault();
      goRoom("vault", shell, false);
    });
    await refreshDen();
    try {
      const profile = await me();
      shell.hpLine.textContent = `HP 14/14 · ${profile.handle.toUpperCase()} · ${profile.mode.toUpperCase()}`;
    } catch {
      shell.hpLine.textContent = "HP 14/14 · SESSION WEAK";
    }
  }

  function bootVault() {
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
    }
  }

  shell.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const room = btn.dataset.room as Room;
      if (room !== "vault" && room !== "void" && !unlocked) {
        const msg = shell.vault.querySelector("#lockMsg");
        if (msg) {
          msg.textContent = "ROOM LOCKED // CLEAR VAULT FIRST";
          msg.className = "msg bad";
        }
        goRoom("vault", shell, unlocked);
        return;
      }
      goRoom(room, shell, unlocked);
      void paintRoom(room);
    });
  });

  window.setInterval(() => {
    void pingHealth().then((ok) => setApiPill(shell.apiPill, ok));
  }, 15000);
}
