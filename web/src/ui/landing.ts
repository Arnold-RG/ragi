import { renderUnlock } from "./unlock";
import { mountAnimeStage, type StageHandle } from "../motion/animeStage";

function theaterMarkup(ctaId: string) {
  return `
    <div class="ajs-page" id="ajsRoot">
      <header class="ajs-top">
        <div class="ajs-brand">
          <img src="${import.meta.env.BASE_URL}logo.svg" width="32" height="32" alt="" />
          <strong>RAGI</strong>
        </div>
        <button type="button" class="ajs-cta" id="${ctaId}">Enter vault</button>
      </header>

      <section class="ajs-panel ajs-hero">
        <p class="ajs-eyebrow">Private secretary · motion desk</p>
        <h1 class="ajs-title">
          <span data-ajs-word>Scroll</span>
          <span data-ajs-word>to</span>
          <span data-ajs-word>synchronise</span>
        </h1>
        <p class="ajs-lead">Live animation scrolling — the same Scroll Observer energy as Anime.js, tuned for your sealed vault.</p>
        <div class="ajs-grid" data-ajs-grid aria-hidden="true"></div>
        <p class="ajs-hint">Scroll down · demos stay locked to your scroll position</p>
      </section>

      <section class="ajs-panel ajs-split">
        <div class="ajs-sticky">
          <svg class="ajs-svg" viewBox="0 0 420 240" fill="none" aria-hidden="true">
            <path data-ajs-draw d="M30 180 C80 40, 140 40, 180 120 S280 220, 390 60" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            <path data-ajs-draw d="M30 200 C120 120, 200 200, 280 140 S360 80, 390 160" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>
          </svg>
          <div class="ajs-clock">
            <div class="ajs-ticker" data-ajs-ticker>
              ${Array.from({ length: 12 }, (_, i) => `<i data-ajs-tick style="--i:${i}"></i>`).join("")}
            </div>
          </div>
        </div>
        <div class="ajs-copy">
          <h2>Scroll Observer</h2>
          <p>Paths draw and clocks tick in sync with scroll — not a one-shot fade. Keep scrolling to scrub the timeline forward and back.</p>
          <ul>
            <li>Synchronised draw modes</li>
            <li>Sticky visual stage</li>
            <li>Progress locked to scroll</li>
          </ul>
          <div class="ajs-spacer" aria-hidden="true"></div>
        </div>
      </section>

      <section class="ajs-panel ajs-marquee-panel">
        <div class="ajs-marquee" data-ajs-marquee>
          <span>PRODUCTION · PACE · TIME · ERRORS · FOCUS · SHIP · TRIAGE · REVIEW ·</span>
          <span>PRODUCTION · PACE · TIME · ERRORS · FOCUS · SHIP · TRIAGE · REVIEW ·</span>
        </div>
      </section>

      <section class="ajs-panel ajs-shapes-panel">
        <div class="ajs-shapes" aria-hidden="true">
          <span class="ajs-shape s1" data-ajs-shape></span>
          <span class="ajs-shape s2" data-ajs-shape></span>
          <span class="ajs-shape s3" data-ajs-shape></span>
          <span class="ajs-shape s4" data-ajs-shape></span>
          <span class="ajs-shape s5" data-ajs-shape></span>
          <span class="ajs-shape s6" data-ajs-shape></span>
        </div>
        <div class="ajs-copy center">
          <h2>Enhanced transforms</h2>
          <p>Shapes blend, rotate, and scrub with scroll — composition mode the way Anime.js demos it.</p>
        </div>
      </section>

      <section class="ajs-panel ajs-cards">
        <article class="ajs-card" data-ajs-card>
          <h3>Stagger grids</h3>
          <p>Center-out scale waves across the hero grid as you move.</p>
        </article>
        <article class="ajs-card" data-ajs-card>
          <h3>SVG toolset</h3>
          <p>Drawable strokes scrub from 0 → 1 with the scroll engine.</p>
        </article>
        <article class="ajs-card" data-ajs-card>
          <h3>Springs</h3>
          <p>Grab the orb below — flick it and feel the spring release.</p>
        </article>
      </section>

      <section class="ajs-panel ajs-drag-panel">
        <h2>Draggable spring</h2>
        <p>Drag, throw, snap back.</p>
        <div class="ajs-drag-pad">
          <button type="button" class="ajs-drag" data-ajs-drag aria-label="Draggable orb">RAGI</button>
        </div>
      </section>

      <section class="ajs-panel ajs-finale" id="vaultLoginAnchor">
        <h2>Enter your sealed vault</h2>
        <p>Tasks, GitHub intel, money, schedule, notes — with the same motion language after you sign in.</p>
        <div id="landingVaultHost"></div>
      </section>
    </div>
  `;
}

/** Pre-login Anime.js-style scroll site, with vault login at the end. */
export function renderLanding(root: HTMLElement, onUnlocked: () => void): () => void {
  root.classList.add("is-landing");
  document.body.classList.add("is-landing");
  root.innerHTML = theaterMarkup("landingEnterTop");

  const page = root.querySelector("#ajsRoot") as HTMLElement;
  let stage: StageHandle | null = mountAnimeStage(page);

  const host = root.querySelector("#landingVaultHost") as HTMLElement;
  renderUnlock(host, () => {
    document.body.classList.remove("is-landing");
    root.classList.remove("is-landing");
    onUnlocked();
  });

  const goLogin = () => {
    document.getElementById("vaultLoginAnchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  root.querySelector("#landingEnterTop")?.addEventListener("click", goLogin);

  return () => {
    stage?.dispose();
    stage = null;
    document.body.classList.remove("is-landing");
    root.classList.remove("is-landing");
  };
}
