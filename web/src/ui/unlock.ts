import { loginAccount, registerAccount, resetPassword } from "../api/auth";
import { ApiError, pageCanReachApi } from "../api/client";
import { getRememberMe, setRememberMe } from "../state/session";
import { LocalAuthError } from "../vault/localAuth";

const LOGO = `${import.meta.env.BASE_URL}logo.svg`;

export function renderUnlock(root: HTMLElement, onUnlocked: () => void) {
  const server = pageCanReachApi();
  const remember = getRememberMe();

  root.innerHTML = `
    <div class="vault-stage">
      <section class="vault-glass" aria-label="Vault login">
        <div class="vault-brand">
          <img class="vault-logo" src="${LOGO}" width="72" height="72" alt="RAGI logo" />
          <h2 class="vault-wordmark" tabindex="-1">RAGI</h2>
          <p class="vault-tag">Private secretary · sealed vault</p>
        </div>

        <div class="vault-secure-row" aria-hidden="true">
          <span class="vault-chip"><i></i> Argon / PBKDF2 hash</span>
          <span class="vault-chip"><i></i> ${server ? "Durable DB seal" : "Device vault seal"}</span>
        </div>

        <p class="msg" data-room-msg role="status"></p>

        <form class="vault-form" id="enterPanel">
          <label class="vault-field">
            <span>Email</span>
            <input id="loginEmail" name="email" type="email" autocomplete="username" inputmode="email" required maxlength="254" placeholder="Email" />
          </label>
          <label class="vault-field">
            <span>Password</span>
            <div class="vault-pass">
              <input id="loginPassword" name="password" type="password" autocomplete="current-password" required maxlength="128" placeholder="Password" />
              <button type="button" class="vault-eye" data-reveal="loginPassword" aria-label="Show password" aria-pressed="false">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>
              </button>
            </div>
          </label>

          <label class="vault-remember">
            <input id="rememberMe" type="checkbox" ${remember ? "checked" : ""} />
            <span class="vault-switch" aria-hidden="true"></span>
            <span>Remember me on this device</span>
          </label>

          <button type="submit" class="vault-cta">Log in</button>
          <button type="button" class="vault-link" id="forgotLink">Forgot your password?</button>
        </form>

        <form class="vault-form" id="joinPanel" hidden>
          <label class="vault-field">
            <span>Name</span>
            <input id="joinHandle" name="handle" autocomplete="nickname" required minlength="2" maxlength="24" spellcheck="false" placeholder="your-name" />
          </label>
          <p class="vault-hint">Letters, numbers, hyphens. Starts with a letter. Unique forever.</p>
          <label class="vault-field">
            <span>Email</span>
            <input id="joinEmail" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="Email" />
          </label>
          <label class="vault-field">
            <span>Password</span>
            <div class="vault-pass">
              <input id="joinPassword" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="At least 12 characters" />
              <button type="button" class="vault-eye" data-reveal="joinPassword" aria-label="Show password" aria-pressed="false">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>
              </button>
            </div>
          </label>
          <label class="vault-field">
            <span>Confirm password</span>
            <input id="joinPassword2" name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="Repeat password" />
          </label>
          <p class="vault-hint">One recovery key is shown once after create. Store it offline.</p>
          <button type="submit" class="vault-cta">Create sealed account</button>
          <button type="button" class="vault-link" id="backFromJoin">Back to log in</button>
        </form>

        <form class="vault-form" id="resetPanel" hidden>
          <label class="vault-field">
            <span>Email</span>
            <input id="resetEmail" name="email" type="email" autocomplete="username" inputmode="email" required maxlength="254" placeholder="Email" />
          </label>
          <label class="vault-field">
            <span>Recovery key</span>
            <input id="resetKey" name="recovery" autocomplete="off" required maxlength="64" spellcheck="false" placeholder="RAGI-XXXXXXXX-XXXXXXXX-XXXXXXXX" />
          </label>
          <label class="vault-field">
            <span>New password</span>
            <input id="resetPassword" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="New password" />
          </label>
          <label class="vault-field">
            <span>Confirm new password</span>
            <input id="resetPassword2" name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="Repeat new password" />
          </label>
          <button type="submit" class="vault-cta">Reset password</button>
          <button type="button" class="vault-link" id="backToSignIn">Back to log in</button>
        </form>

        <div id="recoveryBox" class="recovery-box" hidden>
          <h3>Save your recovery key</h3>
          <p>Shown once. Without it you cannot reset a forgotten password.</p>
          <code id="recoveryKey"></code>
          <div class="form-actions">
            <button type="button" class="vault-cta" id="recoveryDone">I saved it — enter vault</button>
            <button type="button" class="vault-ghost" id="recoveryCopy">Copy</button>
          </div>
        </div>

        <div class="vault-footer" id="vaultFooter">
          <div class="vault-rule" aria-hidden="true"></div>
          <p class="vault-signup">
            Don't have an account?
            <button type="button" class="vault-link-inline" id="tabJoin">Sign up for RAGI</button>
          </p>
          <p class="vault-fine">${
            server
              ? "Passwords are hashed and sealed in the durable vault. Duplicate emails are refused."
              : "Passwords are hashed in this browser vault. Duplicate emails are refused."
          }</p>
        </div>
      </section>
    </div>
  `;

  const msg = root.querySelector<HTMLElement>("[data-room-msg]")!;
  const enterPanel = root.querySelector<HTMLFormElement>("#enterPanel")!;
  const joinPanel = root.querySelector<HTMLFormElement>("#joinPanel")!;
  const resetPanel = root.querySelector<HTMLFormElement>("#resetPanel")!;
  const recoveryBox = root.querySelector<HTMLElement>("#recoveryBox")!;
  const recoveryKeyEl = root.querySelector<HTMLElement>("#recoveryKey")!;
  const footer = root.querySelector<HTMLElement>("#vaultFooter")!;
  const rememberEl = root.querySelector<HTMLInputElement>("#rememberMe")!;
  let pendingUnlock: (() => void) | null = null;

  function show(which: "enter" | "join" | "reset") {
    enterPanel.hidden = which !== "enter";
    joinPanel.hidden = which !== "join";
    resetPanel.hidden = which !== "reset";
    recoveryBox.hidden = true;
    footer.hidden = which === "reset";
    msg.textContent = "";
    msg.className = "msg";
    const focusId =
      which === "join" ? "#joinHandle" : which === "reset" ? "#resetEmail" : "#loginEmail";
    root.querySelector<HTMLInputElement>(focusId)?.focus();
  }

  root.querySelector("#tabJoin")?.addEventListener("click", () => show("join"));
  root.querySelector("#forgotLink")?.addEventListener("click", () => show("reset"));
  root.querySelector("#backToSignIn")?.addEventListener("click", () => show("enter"));
  root.querySelector("#backFromJoin")?.addEventListener("click", () => show("enter"));

  rememberEl.addEventListener("change", () => setRememberMe(rememberEl.checked));

  root.querySelectorAll<HTMLButtonElement>("[data-reveal]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = root.querySelector<HTMLInputElement>(`#${button.dataset.reveal}`);
      if (!input) return;
      const showText = input.type === "password";
      input.type = showText ? "text" : "password";
      button.setAttribute("aria-pressed", String(showText));
      button.setAttribute("aria-label", showText ? "Hide password" : "Show password");
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
      footer.hidden = true;
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
    setRememberMe(rememberEl.checked);
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
    setRememberMe(true);
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
