import { loginAccount, registerAccount, resetPassword } from "../api/auth";
import { ApiError, pageCanReachApi } from "../api/client";
import { LocalAuthError } from "../vault/localAuth";

export function renderUnlock(root: HTMLElement, onUnlocked: () => void) {
  const server = pageCanReachApi();
  root.innerHTML = `
    <div class="gate">
      <div class="gate-hero">
        <p class="gate-eyebrow">Private secretary · sealed vault</p>
        <h2 class="gate-brand" tabindex="-1">RAGI</h2>
        <p class="gate-line">Your work, money, time, and notes — behind a live hologram only you unlock.</p>
        <div class="gate-signals" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      </div>

      <div class="gate-dock">
        <div class="auth-switch" role="tablist" aria-label="Account">
          <button type="button" id="tabEnter" role="tab" aria-selected="true" aria-controls="enterPanel">Sign in</button>
          <button type="button" id="tabJoin" role="tab" aria-selected="false" aria-controls="joinPanel">Create account</button>
          <button type="button" id="tabReset" role="tab" aria-selected="false" aria-controls="resetPanel">Forgot</button>
        </div>
        <p class="msg" data-room-msg role="status"></p>
        <p class="hint auth-mode">${
          server
            ? "Accounts seal into the durable vault database. The same email cannot be registered twice."
            : "Accounts seal into this device’s encrypted vault (IndexedDB). Passwords are hashed — never stored in plain text. The same email cannot be registered twice."
        }</p>
        <form class="stack auth-form" id="enterPanel" aria-labelledby="tabEnter">
          <label class="field"><span>Email</span><input id="loginEmail" name="email" type="email" autocomplete="username" inputmode="email" required maxlength="254" /></label>
          <label class="field"><span>Password</span><input id="loginPassword" name="password" type="password" autocomplete="current-password" required maxlength="128" /></label>
          <div class="form-actions">
            <button type="submit" class="primary">Open vault</button>
            <button type="button" class="ghost" data-reveal="loginPassword" aria-pressed="false">Show</button>
          </div>
        </form>
        <form class="stack auth-form" id="joinPanel" hidden aria-labelledby="tabJoin">
          <label class="field"><span>Name</span><input id="joinHandle" name="handle" autocomplete="nickname" required minlength="2" maxlength="24" spellcheck="false" /></label>
          <p class="hint">Letters, numbers, and hyphens.</p>
          <label class="field"><span>Email</span><input id="joinEmail" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" /></label>
          <label class="field"><span>Password</span><input id="joinPassword" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
          <label class="field"><span>Confirm</span><input id="joinPassword2" name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
          <p class="hint">At least 12 characters. You get one recovery key after create — store it offline.</p>
          <div class="form-actions">
            <button type="submit" class="primary">Create account</button>
            <button type="button" class="ghost" data-reveal="joinPassword" aria-pressed="false">Show</button>
          </div>
        </form>
        <form class="stack auth-form" id="resetPanel" hidden aria-labelledby="tabReset">
          <label class="field"><span>Email</span><input id="resetEmail" name="email" type="email" autocomplete="username" inputmode="email" required maxlength="254" /></label>
          <label class="field"><span>Recovery key</span><input id="resetKey" name="recovery" autocomplete="off" required maxlength="64" spellcheck="false" /></label>
          <label class="field"><span>New password</span><input id="resetPassword" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
          <label class="field"><span>Confirm new password</span><input id="resetPassword2" name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
          <div class="form-actions">
            <button type="submit" class="primary">Reset password</button>
          </div>
        </form>
        <div id="recoveryBox" class="recovery-box" hidden>
          <h3>Save your recovery key</h3>
          <p>This key is shown once. Without it you cannot reset a forgotten password. Store it offline.</p>
          <code id="recoveryKey"></code>
          <div class="form-actions">
            <button type="button" class="primary" id="recoveryDone">I saved it — enter vault</button>
            <button type="button" class="ghost" id="recoveryCopy">Copy</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const msg = root.querySelector<HTMLElement>("[data-room-msg]")!;
  const enterPanel = root.querySelector<HTMLFormElement>("#enterPanel")!;
  const joinPanel = root.querySelector<HTMLFormElement>("#joinPanel")!;
  const resetPanel = root.querySelector<HTMLFormElement>("#resetPanel")!;
  const recoveryBox = root.querySelector<HTMLElement>("#recoveryBox")!;
  const recoveryKeyEl = root.querySelector<HTMLElement>("#recoveryKey")!;
  const tabEnter = root.querySelector<HTMLButtonElement>("#tabEnter")!;
  const tabJoin = root.querySelector<HTMLButtonElement>("#tabJoin")!;
  const tabReset = root.querySelector<HTMLButtonElement>("#tabReset")!;
  let pendingUnlock: (() => void) | null = null;

  function show(which: "enter" | "join" | "reset") {
    enterPanel.hidden = which !== "enter";
    joinPanel.hidden = which !== "join";
    resetPanel.hidden = which !== "reset";
    recoveryBox.hidden = true;
    tabEnter.setAttribute("aria-selected", String(which === "enter"));
    tabJoin.setAttribute("aria-selected", String(which === "join"));
    tabReset.setAttribute("aria-selected", String(which === "reset"));
    msg.textContent = "";
    msg.className = "msg";
    const focusId =
      which === "join" ? "#joinHandle" : which === "reset" ? "#resetEmail" : "#loginEmail";
    root.querySelector<HTMLInputElement>(focusId)?.focus();
  }

  tabEnter.addEventListener("click", () => show("enter"));
  tabJoin.addEventListener("click", () => show("join"));
  tabReset.addEventListener("click", () => show("reset"));

  root.querySelectorAll<HTMLButtonElement>("[data-reveal]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = root.querySelector<HTMLInputElement>(`#${button.dataset.reveal}`);
      if (!input) return;
      const showText = input.type === "password";
      input.type = showText ? "text" : "password";
      button.textContent = showText ? "Hide" : "Show";
      button.setAttribute("aria-pressed", String(showText));
    });
  });

  function fail(err: unknown) {
    msg.textContent =
      err instanceof ApiError || err instanceof LocalAuthError || err instanceof Error
        ? err.message
        : "The vault could not open.";
    msg.className = "msg bad";
  }

  function finish(session: { recoveryKey?: string }) {
    if (session.recoveryKey) {
      recoveryKeyEl.textContent = session.recoveryKey;
      enterPanel.hidden = true;
      joinPanel.hidden = true;
      resetPanel.hidden = true;
      recoveryBox.hidden = false;
      pendingUnlock = onUnlocked;
      msg.textContent = "Account sealed. Save the recovery key before you continue.";
      msg.className = "msg good";
      return;
    }
    onUnlocked();
  }

  root.querySelector("#recoveryDone")?.addEventListener("click", () => {
    pendingUnlock?.();
    pendingUnlock = null;
  });

  root.querySelector("#recoveryCopy")?.addEventListener("click", async () => {
    const key = recoveryKeyEl.textContent || "";
    try {
      await navigator.clipboard.writeText(key);
      msg.textContent = "Recovery key copied.";
      msg.className = "msg good";
    } catch {
      msg.textContent = "Copy failed — select the key and copy it manually.";
      msg.className = "msg bad";
    }
  });

  enterPanel.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = (root.querySelector<HTMLInputElement>("#loginEmail")!.value || "").trim();
    const password = root.querySelector<HTMLInputElement>("#loginPassword")!.value;
    const btn = enterPanel.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    btn.disabled = true;
    msg.textContent = "Checking the seal…";
    msg.className = "msg";
    void loginAccount({ email, password })
      .then((session) => finish(session))
      .catch(fail)
      .finally(() => {
        btn.disabled = false;
      });
  });

  joinPanel.addEventListener("submit", (event) => {
    event.preventDefault();
    const handle = (root.querySelector<HTMLInputElement>("#joinHandle")!.value || "").trim();
    const email = (root.querySelector<HTMLInputElement>("#joinEmail")!.value || "").trim();
    const password = root.querySelector<HTMLInputElement>("#joinPassword")!.value;
    const confirm = root.querySelector<HTMLInputElement>("#joinPassword2")!.value;
    if (password !== confirm) {
      msg.textContent = "The two passwords do not match.";
      msg.className = "msg bad";
      return;
    }
    const btn = joinPanel.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    btn.disabled = true;
    msg.textContent = "Sealing your account…";
    msg.className = "msg";
    void registerAccount({ email, handle, password })
      .then((session) => finish(session))
      .catch(fail)
      .finally(() => {
        btn.disabled = false;
      });
  });

  resetPanel.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = (root.querySelector<HTMLInputElement>("#resetEmail")!.value || "").trim();
    const recoveryKey = (root.querySelector<HTMLInputElement>("#resetKey")!.value || "").trim();
    const newPassword = root.querySelector<HTMLInputElement>("#resetPassword")!.value;
    const confirm = root.querySelector<HTMLInputElement>("#resetPassword2")!.value;
    if (newPassword !== confirm) {
      msg.textContent = "The two passwords do not match.";
      msg.className = "msg bad";
      return;
    }
    const btn = resetPanel.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    btn.disabled = true;
    msg.textContent = "Resetting the seal…";
    msg.className = "msg";
    void resetPassword({ email, recoveryKey, newPassword })
      .then((session) => finish(session))
      .catch(fail)
      .finally(() => {
        btn.disabled = false;
      });
  });
}
