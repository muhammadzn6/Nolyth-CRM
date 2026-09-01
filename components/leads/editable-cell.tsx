"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { isSafeWebUrl } from "@/lib/utils/url";

type EditableCellProps = {
  value: string;
  displayValue?: string;
  placeholder?: string;
  type?: "text" | "number" | "url";
  align?: "left" | "right";
  className?: string;
  readOnly?: boolean;
  onCommit: (value: string) => void;
  onNavigateNext?: () => void;
  onNavigatePrevious?: () => void;
  onNavigateDown?: () => void;
};

export function EditableCell({
  value,
  displayValue,
  placeholder = "—",
  type = "text",
  align = "left",
  className,
  readOnly = false,
  onCommit,
  onNavigateNext,
  onNavigatePrevious,
  onNavigateDown,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    if (draft !== value) {
      onCommit(draft);
    }
  };

  if (readOnly) {
    return (
      <div className={cn("min-h-8 px-2 py-1.5 text-sm text-muted", className)}>
        {displayValue || value || placeholder}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setIsEditing(true);
        }}
        className={cn(
          "group flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-default/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft",
          align === "right" && "justify-end text-right",
          className,
        )}
      >
        <span className={cn(!value && "text-muted")}>
          {displayValue || value || placeholder}
        </span>
        {type === "url" && value && isSafeWebUrl(value) ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Open job URL"
            onClick={(event) => event.stopPropagation()}
            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-muted opacity-0 transition hover:text-accent group-hover:opacity-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </button>
    );
  }

  return (
    <Input
      ref={inputRef}
      type={type === "number" ? "number" : "text"}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          onNavigateDown?.();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(value);
          setIsEditing(false);
        }

        if (event.key === "Tab" && !event.shiftKey) {
          event.preventDefault();
          commit();
          onNavigateNext?.();
        }

        if (event.key === "Tab" && event.shiftKey) {
          event.preventDefault();
          commit();
          onNavigatePrevious?.();
        }
      }}
      className={cn("h-8 text-sm", align === "right" && "text-right", className)}
    />
  );
}
