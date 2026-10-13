import { loginAccount, registerAccount } from "../api/auth";
import { ApiError, pageCanReachApi } from "../api/client";
import { setToken } from "../state/session";

export function renderUnlock(root: HTMLElement, onUnlocked: () => void) {
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
        </div>
        <p class="msg" data-room-msg role="status"></p>
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
          <p class="hint">At least 12 characters.</p>
          <div class="form-actions">
            <button type="submit" class="primary">Create key</button>
            <button type="button" class="ghost" data-reveal="joinPassword" aria-pressed="false">Show</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const msg = root.querySelector<HTMLElement>("[data-room-msg]")!;
  if (!pageCanReachApi()) {
    msg.textContent = "This public page is not pointed at an account server yet. The vault UI is live — sign-in starts when VITE_API_ORIGIN is set for the build.";
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
    msg.textContent = pageCanReachApi() ? "" : msg.textContent;
    if (pageCanReachApi()) msg.className = "msg";
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
      button.textContent = showText ? "Hide" : "Show";
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
