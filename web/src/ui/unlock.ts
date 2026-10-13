import { loginAccount, registerAccount } from "../api/auth";
import { ApiError, pageCanReachApi } from "../api/client";
import { setToken } from "../state/session";

export function renderUnlock(root: HTMLElement, onUnlocked: () => void) {
  root.innerHTML = `
    <header class="room-head">
      <p class="room-index">N-14</p>
      <h2 class="prompt" tabindex="-1">Vault</h2>
    </header>
    <p class="lore">
      RAGI keeps a private record of work, money, time, and notes.
      Create an account with your email. The password is stored only as an Argon2id hash.
      What you write is encrypted for your account and is not readable by anyone else.
    </p>
    <div class="auth-switch" role="tablist" aria-label="Account">
      <button type="button" id="tabEnter" role="tab" aria-selected="true" aria-controls="enterPanel">Sign in</button>
      <button type="button" id="tabJoin" role="tab" aria-selected="false" aria-controls="joinPanel">Create account</button>
    </div>
    <p class="msg" data-room-msg role="status"></p>
    <form class="stack auth-form" id="enterPanel" aria-labelledby="tabEnter">
      <label class="field"><span>Email</span><input id="loginEmail" name="email" type="email" autocomplete="username" inputmode="email" required maxlength="254" /></label>
      <label class="field"><span>Password</span><input id="loginPassword" name="password" type="password" autocomplete="current-password" required maxlength="128" /></label>
      <div class="form-actions">
        <button type="submit" class="primary">Enter</button>
        <button type="button" class="ghost" data-reveal="loginPassword" aria-pressed="false">Show password</button>
      </div>
    </form>
    <form class="stack auth-form" id="joinPanel" hidden aria-labelledby="tabJoin">
      <label class="field"><span>Name</span><input id="joinHandle" name="handle" autocomplete="nickname" required minlength="2" maxlength="24" spellcheck="false" /></label>
      <p class="hint">Letters, numbers, and hyphens. This is how the house addresses you.</p>
      <label class="field"><span>Email</span><input id="joinEmail" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" /></label>
      <label class="field"><span>Password</span><input id="joinPassword" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
      <label class="field"><span>Confirm password</span><input id="joinPassword2" name="confirm" type="password" autocomplete="new-password" required minlength="12" maxlength="128" /></label>
      <p class="hint">At least 12 characters. A long passphrase is better than a clever short one.</p>
      <div class="form-actions">
        <button type="submit" class="primary">Create account</button>
        <button type="button" class="ghost" data-reveal="joinPassword" aria-pressed="false">Show password</button>
      </div>
    </form>
  `;

  const msg = root.querySelector<HTMLElement>("[data-room-msg]")!;
  if (!pageCanReachApi()) {
    msg.textContent = "This public page is not pointed at an account server yet. The house is here. Sign-up starts when the API origin is set for the build.";
    msg.className = "msg";
    root.querySelectorAll("form button[type=submit]").forEach((button) => {
      (button as HTMLButtonElement).disabled = true;
    });
  }
  const enterPanel = root.querySelector<HTMLFormElement>("#enterPanel")!;
  const joinPanel = root.querySelector<HTMLFormElement>("#joinPanel")!;
  const tabEnter = root.querySelector<HTMLButtonElement>("#tabEnter")!;
  const tabJoin = root.querySelector<HTMLButtonElement>("#tabJoin")!;

  function show(which: "enter" | "join") {
    const join = which === "join";
    enterPanel.hidden = join;
    joinPanel.hidden = !join;
    tabEnter.setAttribute("aria-selected", String(!join));
    tabJoin.setAttribute("aria-selected", String(join));
    msg.textContent = "";
    (join ? root.querySelector<HTMLInputElement>("#joinHandle") : root.querySelector<HTMLInputElement>("#loginEmail"))?.focus();
  }

  tabEnter.addEventListener("click", () => show("enter"));
  tabJoin.addEventListener("click", () => show("join"));

  root.querySelectorAll<HTMLButtonElement>("[data-reveal]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = root.querySelector<HTMLInputElement>(`#${button.dataset.reveal}`);
      if (!input) return;
      const showText = input.type === "password";
      input.type = showText ? "text" : "password";
      button.textContent = showText ? "Hide password" : "Show password";
      button.setAttribute("aria-pressed", String(showText));
    });
  });

  function fail(err: unknown) {
    msg.textContent = err instanceof ApiError ? err.message : "The vault could not open.";
    msg.className = "msg bad";
  }

  enterPanel.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = (root.querySelector<HTMLInputElement>("#loginEmail")!.value || "").trim();
    const password = root.querySelector<HTMLInputElement>("#loginPassword")!.value;
    msg.textContent = "Checking the seal…";
    msg.className = "msg";
    void loginAccount({ email, password })
      .then((session) => {
        setToken(session.token);
        onUnlocked();
      })
      .catch(fail);
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
    msg.textContent = "Cutting a key…";
    msg.className = "msg";
    void registerAccount({ email, handle, password })
      .then((session) => {
        setToken(session.token);
        onUnlocked();
      })
      .catch(fail);
  });
}
