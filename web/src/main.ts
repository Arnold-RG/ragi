import "./styles/premium.css";
import "./styles/craft.css";
import { mountOrbField } from "./scene/orbField";
import { startApp } from "./app";

const host = document.getElementById("scene-host");
const root = document.getElementById("app");
if (!root) throw new Error("#app missing");

let scene: ReturnType<typeof mountOrbField> | null = null;
if (host) {
  try {
    scene = mountOrbField(host);
  } catch {
    /* WebGL optional — UI still runs */
  }
}

void startApp(root).then(() => {
  document.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("button.primary, #sendBtn, #micBtn")) scene?.pulse();
    },
    true,
  );
  window.addEventListener("ragi:pulse", () => scene?.pulse());
});

window.addEventListener("beforeunload", () => scene?.dispose());
