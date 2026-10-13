/**
 * Anime.js.com-style scroll theater: sync scroll, stagger grids, drawable paths, springs.
 */

import {
  animate,
  createDrawable,
  createDraggable,
  createSpring,
  createTimeline,
  onScroll,
  random,
  stagger,
} from "animejs";

export type StageHandle = { dispose: () => void };

const reduced = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function containerOf(root: HTMLElement): HTMLElement {
  // Landing uses document scroll (animejs.com feel). In-app Motion uses .app-main.
  if (document.body.classList.contains("is-landing")) return document.documentElement;
  return (root.closest(".app-main") as HTMLElement | null) ?? document.documentElement;
}

/** Build a center-out dot grid like the animejs.com stagger demo. */
export function fillDotGrid(host: HTMLElement, cols = 13, rows = 9) {
  host.replaceChildren();
  host.style.setProperty("--ajs-cols", String(cols));
  for (let i = 0; i < cols * rows; i++) {
    const d = document.createElement("span");
    d.className = "ajs-dot";
    host.appendChild(d);
  }
  return { cols, rows, count: cols * rows };
}

/** Mount full scroll-synced demos inside a stage root (landing or Motion room). */
export function mountAnimeStage(root: HTMLElement): StageHandle {
  const disposers: Array<() => void> = [];
  if (reduced()) return { dispose: () => undefined };

  const scroller = containerOf(root);

  // —— 1) Hero grid: scroll-synced stagger from center ——
  const grid = root.querySelector<HTMLElement>("[data-ajs-grid]");
  if (grid) {
    const { cols, rows } = fillDotGrid(grid, 13, 9);
    const dots = grid.querySelectorAll(".ajs-dot");
    const gridAnim = animate(dots, {
      scale: stagger([1.25, 0.35], { grid: [cols, rows], from: "center" }),
      opacity: stagger([1, 0.25], { grid: [cols, rows], from: "center" }),
      ease: "inOutQuad",
      autoplay: onScroll({
        target: grid.closest(".ajs-panel") as HTMLElement,
        container: scroller,
        sync: true,
        enter: "top top",
        leave: "bottom top",
      }),
    });
    disposers.push(() => {
      try {
        gridAnim.pause();
      } catch {
        /* ignore */
      }
    });
  }

  // —— 2) SVG draw synced to scroll (exact animejs.com pattern) ——
  root.querySelectorAll<SVGPathElement>("path[data-ajs-draw]").forEach((path) => {
    try {
      const section = path.closest(".ajs-panel") as HTMLElement;
      const drawable = createDrawable(path);
      const drawAnim = animate(drawable, {
        draw: ["0 0", "0 1", "1 1"],
        delay: stagger(40),
        ease: "inOut(3)",
        autoplay: onScroll({
          target: section,
          container: scroller,
          sync: true,
          enter: "top bottom",
          leave: "bottom top",
        }),
      });
      disposers.push(() => {
        try {
          drawAnim.pause();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* optional */
    }
  });

  // —— 3) Floating shapes — blend composition, scroll scrub rotate ——
  const shapes = root.querySelectorAll<HTMLElement>("[data-ajs-shape]");
  if (shapes.length) {
    shapes.forEach((shape, i) => {
      const float = animate(shape, {
        x: random(-40, 40),
        y: random(-30, 30),
        rotate: random(-180, 180),
        duration: random(900, 1600),
        composition: "blend",
        loop: true,
        alternate: true,
        ease: "inOut(2)",
        delay: i * 80,
      });
      disposers.push(() => float.pause());
    });
    const shapeSection = shapes[0]?.closest(".ajs-panel") as HTMLElement | null;
    if (shapeSection) {
      const scrub = animate(shapes, {
        scale: [0.7, 1.15],
        opacity: [0.35, 1],
        ease: "linear",
        autoplay: onScroll({
          target: shapeSection,
          container: scroller,
          sync: true,
        }),
      });
      disposers.push(() => scrub.pause());
    }
  }

  // —— 4) Sticky card stack — panels rise as you scroll ——
  root.querySelectorAll<HTMLElement>("[data-ajs-card]").forEach((card, i) => {
    const anim = animate(card, {
      y: [80, 0],
      opacity: [0, 1],
      rotate: [i % 2 === 0 ? -4 : 4, 0],
      ease: "out(3)",
      autoplay: onScroll({
        target: card,
        container: scroller,
        sync: true,
        enter: "bottom-=10% top",
        leave: "top+=20% bottom",
      }),
    });
    disposers.push(() => anim.pause());
  });

  // —— 5) Horizontal marquee scrubbed by vertical scroll ——
  const marquee = root.querySelector<HTMLElement>("[data-ajs-marquee]");
  if (marquee) {
    const panel = marquee.closest(".ajs-panel") as HTMLElement;
    const anim = animate(marquee, {
      x: ["0%", "-50%"],
      ease: "linear",
      autoplay: onScroll({
        target: panel,
        container: scroller,
        sync: true,
        enter: "top bottom",
        leave: "bottom top",
      }),
    });
    disposers.push(() => anim.pause());
  }

  // —— 6) Draggable spring orb ——
  const drag = root.querySelector<HTMLElement>("[data-ajs-drag]");
  if (drag) {
    try {
      const d = createDraggable(drag, {
        container: drag.parentElement ?? root,
        releaseEase: createSpring({ stiffness: 120, damping: 6 }),
      });
      disposers.push(() => {
        try {
          d.revert();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* optional */
    }
  }

  // —— 7) Timeline clock ticks (ambient, like animejs ticker demo) ——
  const ticks = root.querySelectorAll<HTMLElement>("[data-ajs-tick]");
  const ticker = root.querySelector<HTMLElement>("[data-ajs-ticker]");
  if (ticks.length && ticker) {
    const tl = createTimeline({ defaults: { ease: "out(2)" }, loop: true });
    tl.add(
      ticks,
      {
        y: "-=6",
        duration: 50,
        delay: stagger(10),
      },
      0,
    );
    tl.add(
      ticker,
      {
        rotate: 360,
        duration: 1920,
        ease: "linear",
      },
      "<",
    );
    disposers.push(() => {
      try {
        tl.pause();
      } catch {
        /* ignore */
      }
    });
  }

  // —— 8) Big headline word scrub ——
  const words = root.querySelectorAll<HTMLElement>("[data-ajs-word]");
  if (words.length) {
    const panel = words[0].closest(".ajs-panel") as HTMLElement;
    const anim = animate(words, {
      y: stagger([40, 0]),
      opacity: stagger([0, 1]),
      delay: stagger(40),
      ease: "out(3)",
      autoplay: onScroll({
        target: panel,
        container: scroller,
        sync: true,
      }),
    });
    disposers.push(() => anim.pause());
  }

  return {
    dispose: () => {
      disposers.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
    },
  };
}
