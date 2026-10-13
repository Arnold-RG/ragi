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
        <header class="login-bar">
          <div class="login-bar-copy">
            <p class="login-bar-kicker">Access</p>
            <h3 class="login-bar-title">Vault login</h3>
          </div>
          <p class="login-bar-seal" title="${
            server ? "Durable server vault" : "Encrypted device vault"
          }">
            <span class="login-bar-dot" aria-hidden="true"></span>
            <span>${server ? "Server seal" : "Device seal"}</span>
          </p>
        </header>

        <div class="auth-rail" role="tablist" aria-label="Login mode">
          <button type="button" id="tabEnter" class="auth-rail-tab" role="tab" aria-selected="true" aria-controls="enterPanel">
            <span class="auth-rail-label">Sign in</span>
          </button>
          <button type="button" id="tabJoin" class="auth-rail-tab" role="tab" aria-selected="false" aria-controls="joinPanel">
            <span class="auth-rail-label">Create account</span>
          </button>
          <button type="button" id="tabReset" class="auth-rail-tab" role="tab" aria-selected="false" aria-controls="resetPanel" hidden>
            <span class="auth-rail-label">Recover</span>
          </button>
          <span class="auth-rail-glider" aria-hidden="true" data-pos="0"></span>
        </div>

        <p class="msg" data-room-msg role="status"></p>
        <p class="hint auth-mode">${
          server
            ? "Credentials seal into the durable vault. Each email can only be registered once."
            : "Credentials seal into this device’s encrypted vault. Passwords are hashed — never stored plain. Each email can only be registered once."
        }</p>

        <form class="stack auth-form" id="enterPanel" aria-labelledby="tabEnter">
          <label class="field"><span>Email</span><input id="loginEmail" name="email" type="email" autocomplete="username" inputmode="email" required maxlength="254" placeholder="you@domain.com" /></label>
          <label class="field"><span>Password</span><input id="loginPassword" name="password" type="password" autocomplete="current-password" required maxlength="128" placeholder="Your vault password" /></label>
          <div class="form-actions auth-actions">
            <button type="submit" class="primary">Open vault</button>
            <button type="button" class="ghost" data-reveal="loginPassword" aria-pressed="false">Show</button>
          </div>
          <button type="button" class="auth-forgot" id="forgotLink">Forgot password?</button>
        </form>

        <form class="stack auth-form" id="joinPanel" hidden aria-labelledby="tabJoin">
          <label class="field"><span>Name</span><input id="joinHandle" name="handle" autocomplete="nickname" required minlength="2" maxlength="24" spellcheck="false" placeholder="your-name" /></label>
          <p class="hint">Letters, numbers, and hyphens. Starts with a letter.</p>
          <label class="field"><span>Email</span><input id="joinEmail" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="you@domain.com" /></label>
          <label class="field"><span>Password</span><input id="joinPassword" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="At least 12 characters" /></label>
          <label class="field"><span>Confirm password</span><input id="joinPassword2" name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="Repeat password" /></label>
          <p class="hint">You receive one recovery key after create — store it offline.</p>
          <div class="form-actions auth-actions">
            <button type="submit" class="primary">Create account</button>
            <button type="button" class="ghost" data-reveal="joinPassword" aria-pressed="false">Show</button>
          </div>
        </form>

        <form class="stack auth-form" id="resetPanel" hidden aria-labelledby="tabReset">
          <label class="field"><span>Email</span><input id="resetEmail" name="email" type="email" autocomplete="username" inputmode="email" required maxlength="254" placeholder="you@domain.com" /></label>
          <label class="field"><span>Recovery key</span><input id="resetKey" name="recovery" autocomplete="off" required maxlength="64" spellcheck="false" placeholder="RAGI-XXXXXXXX-XXXXXXXX-XXXXXXXX" /></label>
          <label class="field"><span>New password</span><input id="resetPassword" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
          <label class="field"><span>Confirm new password</span><input id="resetPassword2" name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
          <div class="form-actions auth-actions">
            <button type="submit" class="primary">Reset password</button>
            <button type="button" class="ghost" id="backToSignIn">Back to sign in</button>
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
  const glider = root.querySelector<HTMLElement>(".auth-rail-glider")!;
  const rail = root.querySelector<HTMLElement>(".auth-rail")!;
  let pendingUnlock: (() => void) | null = null;

  function setGlider(pos: 0 | 1 | 2) {
    glider.dataset.pos = String(pos);
    const tabs = [tabEnter, tabJoin, tabReset].filter((t) => !t.hidden);
    const active = tabs[Math.min(pos, tabs.length - 1)];
    if (!active) return;
    const railRect = rail.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();
    glider.style.width = `${tabRect.width}px`;
    glider.style.transform = `translateX(${tabRect.left - railRect.left}px)`;
  }

  function show(which: "enter" | "join" | "reset") {
    enterPanel.hidden = which !== "enter";
    joinPanel.hidden = which !== "join";
    resetPanel.hidden = which !== "reset";
    recoveryBox.hidden = true;
    rail.hidden = false;
    const recover = which === "reset";
    tabReset.hidden = !recover;
    rail.classList.toggle("is-recover", recover);
    tabEnter.setAttribute("aria-selected", String(which === "enter"));
    tabJoin.setAttribute("aria-selected", String(which === "join"));
    tabReset.setAttribute("aria-selected", String(recover));
    msg.textContent = "";
    msg.className = "msg";
    requestAnimationFrame(() => setGlider(which === "enter" ? 0 : which === "join" ? 1 : 2));
    const focusId =
      which === "join" ? "#joinHandle" : which === "reset" ? "#resetEmail" : "#loginEmail";
    root.querySelector<HTMLInputElement>(focusId)?.focus();
  }

  tabEnter.addEventListener("click", () => show("enter"));
  tabJoin.addEventListener("click", () => show("join"));
  tabReset.addEventListener("click", () => show("reset"));
  root.querySelector("#forgotLink")?.addEventListener("click", () => show("reset"));
  root.querySelector("#backToSignIn")?.addEventListener("click", () => show("enter"));

  requestAnimationFrame(() => setGlider(0));
  window.addEventListener("resize", () => {
    const selected = root.querySelector('.auth-rail-tab[aria-selected="true"]');
    if (selected === tabEnter) setGlider(0);
    else if (selected === tabJoin) setGlider(1);
    else setGlider(2);
  });

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
      rail.hidden = true;
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
