import { pingHealth } from "./api/client";
import { me } from "./api/auth";
import { createNote, listNotes } from "./api/secretary";
import {
  exportVault,
  listSnapshots,
  restoreSnapshot,
  storageStatus,
  takeSnapshot,
} from "./api/storage";
import { isUnlocked, clearSession } from "./state/session";
import { goRoom, renderShell, setApiPill, unlockNav, lockNav, type Room } from "./ui/shell";
import { renderUnlock } from "./ui/unlock";
import { renderChamber } from "./ui/chamber";
import { renderClock, renderForge, renderGold, renderHome, renderMap } from "./ui/rooms";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function startApp(root: HTMLElement) {
  const shell = renderShell(root);
  let unlocked = isUnlocked();
  let disposeChamber: (() => void) | null = null;

  const healthy = await pingHealth();
  setApiPill(shell.apiPill, healthy);

  async function refreshDen() {
    if (!unlocked) return;
    const list = shell.den.querySelector("#noteList") as HTMLElement | null;
    const storeStatus = shell.den.querySelector("#storeStatus") as HTMLElement | null;
    const snapList = shell.den.querySelector("#snapList") as HTMLElement | null;
    if (!list || !storeStatus || !snapList) return;

    try {
      const res = await listNotes();
      list.innerHTML = res.notes.length
        ? res.notes
            .slice(0, 8)
            .map((n) => `<li><span>${esc(n.title)}</span><span>${esc(n.kind)}</span></li>`)
            .join("")
        : `<li><span>empty ledger</span><span>—</span></li>`;
    } catch {
      list.innerHTML = `<li><span>ledger unreachable</span><span>!</span></li>`;
    }

    try {
      const st = await storageStatus();
      const latest = st.latestSnapshot
        ? `${st.latestSnapshot.id} · ${new Date(st.latestSnapshot.createdAt).toLocaleString()}`
        : "none yet";
      storeStatus.innerHTML = `
        ENGINE :: ${esc(st.engine)} · DURABLE :: ${st.durable ? "YES" : "NO"}<br/>
        SNAPSHOTS :: ${st.snapshotCount}<br/>
        LATEST :: ${esc(latest)}<br/>
        DATA :: ${esc(st.dataRoot)}<br/>
        <span style="opacity:0.75">${esc(st.note)}</span>
      `;
      const snaps = await listSnapshots();
      snapList.innerHTML = snaps.snapshots.length
        ? snaps.snapshots
            .slice(0, 8)
            .map(
              (s) =>
                `<li><span>${esc(s.id)} · ${Math.round(s.bytes / 1024)}kb</span>
                <button type="button" data-restore="${esc(s.id)}">MERGE</button></li>`,
            )
            .join("")
        : `<li><span>no snapshots yet — seal one</span><span>—</span></li>`;

      snapList.querySelectorAll<HTMLButtonElement>("[data-restore]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.restore!;
          btn.disabled = true;
          btn.textContent = "…";
          try {
            const r = await restoreSnapshot(id);
            btn.textContent = `+${r.added}`;
            await refreshDen();
          } catch {
            btn.textContent = "FAIL";
          }
        });
      });
    } catch {
      storeStatus.textContent = "storage backend unreachable";
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

  shell.den.querySelector("#snapBtn")?.addEventListener("click", async () => {
    if (!unlocked) return;
    await takeSnapshot("manual-ui");
    await refreshDen();
  });

  shell.den.querySelector("#exportBtn")?.addEventListener("click", async () => {
    if (!unlocked) return;
    const data = await exportVault();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ragi-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
