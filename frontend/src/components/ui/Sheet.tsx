"use client";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Native <dialog> sheet: bottom sheet on phones, centred modal from md up.
 * showModal() gives a real focus trap, makes the page inert, closes on Esc and
 * returns focus to the trigger (WCAG 2.1.2 / 2.4.3).
 */
export function Sheet({ open, onClose, title, children, id }: { open: boolean; onClose: () => void; title: string; children: ReactNode; id?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
      document.documentElement.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={id}
      className="sheet"
      aria-labelledby={titleId}
      onClose={() => { document.documentElement.style.overflow = ""; if (open) onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {open && (
        <div className="sheet-panel card max-h-[88dvh] overflow-y-auto overscroll-contain rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-b-[var(--arn-radius)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-xl">{title}</h2>
            <button type="button" className="btn btn-ghost icon-btn p-0" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
