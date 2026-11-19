import { mountAnimeStage, type StageHandle } from "../motion/animeStage";

/** Post-login Motion room — full Anime.js-style scroll theater. */
export function renderStage(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="ajs-page ajs-in-app" id="ajsAppRoot">
      <header class="page-head ajs-in-app-head">
        <h2 class="page-title" tabindex="-1">Motion</h2>
        <p class="page-sub">Scroll-synced demos — grid stagger, SVG draw, transforms, springs. Same engine language as animejs.com.</p>
      </header>

      <section class="ajs-panel ajs-hero">
        <p class="ajs-eyebrow">Scroll Observer</p>
        <h1 class="ajs-title">
          <span data-ajs-word>Live</span>
          <span data-ajs-word>scroll</span>
          <span data-ajs-word>animation</span>
        </h1>
        <p class="ajs-lead">Scrub the demos with your scroll wheel. Nothing here is a simple fade-in.</p>
        <div class="ajs-grid" data-ajs-grid aria-hidden="true"></div>
        <p class="ajs-hint">Scroll inside this page to drive every stage</p>
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
          <h2>Drawable + timeline</h2>
          <p>Paths draw as you scroll. The ticker timeline keeps running while the sticky stage stays locked in view.</p>
          <div class="ajs-spacer" aria-hidden="true"></div>
        </div>
      </section>

      <section class="ajs-panel ajs-marquee-panel">
        <div class="ajs-marquee" data-ajs-marquee>
          <span>STAGGER · DRAW · SPRING · DRAG · SYNC · BLEND · TIMELINE ·</span>
          <span>STAGGER · DRAW · SPRING · DRAG · SYNC · BLEND · TIMELINE ·</span>
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
          <h2>Blend composition</h2>
          <p>Shapes wander with blend transforms while scroll scrubs their scale.</p>
        </div>
      </section>

      <section class="ajs-panel ajs-cards">
        <article class="ajs-card" data-ajs-card><h3>Grid stagger</h3><p>Center-out waves across the hero.</p></article>
        <article class="ajs-card" data-ajs-card><h3>Sync scroll</h3><p>Animation progress = scroll progress.</p></article>
        <article class="ajs-card" data-ajs-card><h3>Spring drag</h3><p>Throw the orb and watch it settle.</p></article>
      </section>

      <section class="ajs-panel ajs-drag-panel">
        <h2>Draggable spring</h2>
        <div class="ajs-drag-pad">
          <button type="button" class="ajs-drag" data-ajs-drag aria-label="Draggable orb">RAGI</button>
        </div>
      </section>
    </div>
  `;

  let handle: StageHandle | null = mountAnimeStage(root.querySelector("#ajsAppRoot") as HTMLElement);
  return () => {
    handle?.dispose();
    handle = null;
  };
}
