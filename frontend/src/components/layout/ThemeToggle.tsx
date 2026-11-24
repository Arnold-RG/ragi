"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "dark" | "light";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const read = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export function setTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("arnova-theme", next); } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#f7f1e8" : "#0f0b09");
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "dark");
}

export function ThemeToggle() {
  const theme = useTheme();
  return (
    <button type="button" className="btn btn-ghost icon-btn p-0" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
