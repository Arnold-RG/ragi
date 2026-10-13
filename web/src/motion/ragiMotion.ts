/**
 * Anime.js motion layer — scroll reveals, staggers, SVG draw (animejs.com style).
 */

import { animate, createDrawable, createTimeline, onScroll, stagger } from "animejs";

export type MotionHandle = { dispose: () => void };

const reduced = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollRoot(el: HTMLElement): HTMLElement {
  return (el.closest(".app-main") as HTMLElement | null) ?? document.documentElement;
}

/** Soft enter for a freshly painted room + scroll-linked reveals. */
export function animateRoom(root: HTMLElement): MotionHandle {
  const disposers: Array<() => void> = [];
  if (reduced()) {
    root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    return { dispose: () => undefined };
  }

  const head = root.querySelector<HTMLElement>(".page-head");
  if (head) {
    const a = animate(head, {
      opacity: [0, 1],
      y: [22, 0],
      duration: 720,
      ease: "out(3)",
    });
    disposers.push(() => a.pause());
  }

  const banner = root.querySelector<HTMLElement>(".day-banner, .pulse-hero");
  if (banner) {
    const a = animate(banner, {
      opacity: [0, 1],
      y: [18, 0],
      duration: 780,
      delay: 80,
      ease: "out(3)",
    });
    disposers.push(() => a.pause());
  }

  const metrics = root.querySelectorAll<HTMLElement>(".board-metric, .pulse-stat");
  if (metrics.length) {
    metrics.forEach((el) => {
      el.style.opacity = "0";
    });
    const a = animate(metrics, {
      opacity: [0, 1],
      y: [26, 0],
      scale: [0.96, 1],
      delay: stagger(55, { start: 120 }),
      duration: 640,
      ease: "out(3)",
    });
    disposers.push(() => a.pause());
  }

  const revealables = root.querySelectorAll<HTMLElement>(
    ".panel-card, .board-section, .stat-box, .feedback-list li, .gh-row, .pulse-block, [data-reveal]",
  );
  const container = scrollRoot(root);

  revealables.forEach((el) => {
    if (el.classList.contains("board-metric") || el.classList.contains("pulse-stat")) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(28px)";
    const obs = onScroll({
      target: el,
      container,
      enter: "bottom-=12% top",
      leave: "top+=10% bottom",
      repeat: false,
      onEnter: () => {
        const anim = animate(el, {
          opacity: [0, 1],
          y: [28, 0],
          duration: 700,
          ease: "out(3)",
        });
        disposers.push(() => anim.pause());
      },
    });
    disposers.push(() => obs.revert());
  });

  // Count-up for metric values that look like numbers
  root.querySelectorAll<HTMLElement>(".board-metric .value, .pulse-stat .value").forEach((el) => {
    const raw = el.textContent?.trim() ?? "";
    const match = raw.match(/^(\d+)(.*)$/);
    if (!match) return;
    const target = Number(match[1]);
    const suffix = match[2] ?? "";
    if (!Number.isFinite(target) || target <= 0) return;
    const obj = { n: 0 };
    const a = animate(obj, {
      n: target,
      duration: 1100,
      delay: 200,
      ease: "out(3)",
      onUpdate: () => {
        el.textContent = `${Math.round(obj.n)}${suffix}`;
      },
    });
    disposers.push(() => a.pause());
  });

  // SVG stroke draw (animejs drawable)
  root.querySelectorAll<SVGPathElement>("path[data-draw]").forEach((path, i) => {
    try {
      const drawable = createDrawable(path);
      const a = animate(drawable, {
        draw: ["0 0", "0 1"],
        duration: 1400,
        delay: 160 + i * 90,
        ease: "inOut(3)",
      });
      disposers.push(() => a.pause());
    } catch {
      /* path optional */
    }
  });

  // Scroll-synced horizontal ticker
  const ticker = root.querySelector<HTMLElement>(".pulse-ticker-track");
  if (ticker) {
    const a = animate(ticker, {
      x: ["0%", "-50%"],
      duration: 18000,
      ease: "linear",
      loop: true,
    });
    disposers.push(() => a.pause());
  }

  // Soft ambient float on accent orbs
  root.querySelectorAll<HTMLElement>(".pulse-orb").forEach((orb, i) => {
    const a = animate(orb, {
      y: [0, i % 2 === 0 ? -10 : 10, 0],
      duration: 3200 + i * 400,
      ease: "inOutSine",
      loop: true,
    });
    disposers.push(() => a.pause());
  });

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

/** Vault login entrance — logo pulse + glass rise. */
export function animateVault(root: HTMLElement): MotionHandle {
  if (reduced()) return { dispose: () => undefined };
  const glass = root.querySelector<HTMLElement>(".vault-glass");
  const logo = root.querySelector<HTMLElement>(".vault-logo");
  const word = root.querySelector<HTMLElement>(".vault-wordmark");
  const chips = root.querySelectorAll<HTMLElement>(".vault-chip");
  const tl = createTimeline({ defaults: { ease: "out(3)" } });
  if (glass) {
    tl.add(glass, { opacity: [0, 1], y: [36, 0], duration: 800 }, 0);
  }
  if (logo) {
    tl.add(logo, { scale: [0.7, 1], rotate: [-8, 0], duration: 900 }, 80);
  }
  if (word) {
    tl.add(word, { opacity: [0, 1], y: [12, 0], duration: 600 }, 220);
  }
  if (chips.length) {
    tl.add(
      chips,
      {
        opacity: [0, 1],
        y: [10, 0],
        delay: stagger(70),
        duration: 500,
      },
      320,
    );
  }
  return {
    dispose: () => {
      try {
        tl.pause();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Nav highlight micro-motion when unlocking the app. */
export function animateAppChrome(root: HTMLElement): MotionHandle {
  if (reduced()) return { dispose: () => undefined };
  const nav = root.querySelectorAll<HTMLElement>(".app-nav-btn");
  const top = root.querySelector<HTMLElement>(".app-top");
  const disposers: Array<() => void> = [];
  if (top) {
    const a = animate(top, { opacity: [0, 1], y: [-12, 0], duration: 560, ease: "out(3)" });
    disposers.push(() => a.pause());
  }
  if (nav.length) {
    const a = animate(nav, {
      opacity: [0, 1],
      x: [-16, 0],
      delay: stagger(45),
      duration: 520,
      ease: "out(3)",
    });
    disposers.push(() => a.pause());
  }
  return {
    dispose: () => disposers.forEach((fn) => fn()),
  };
}

export function pulseButton(el: HTMLElement) {
  if (reduced()) return;
  animate(el, {
    scale: [1, 0.96, 1],
    duration: 280,
    ease: "out(2)",
  });
}
