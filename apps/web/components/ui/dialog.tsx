"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Dialog({
  children,
  description,
  onOpenChange,
  open,
  title,
}: {
  children: ReactNode;
  description?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#151922]/35 p-3 backdrop-blur-[3px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative max-h-[min(88vh,820px)] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-border bg-surface p-5 shadow-[0_30px_90px_rgba(17,24,39,0.24)] sm:p-7"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onOpenChange(false);
          }
        }}
        role="dialog"
      >
        <header className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.04em] text-foreground" id={titleId}>{title}</h2>
            {description ? <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground" id={descriptionId}>{description}</p> : null}
          </div>
          <button
            aria-label={`Close ${title}`}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-subtle text-xl text-muted-foreground transition hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => onOpenChange(false)}
            ref={closeRef}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
