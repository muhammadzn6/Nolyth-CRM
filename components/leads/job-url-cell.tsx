"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { formatJobUrlCompact, isSafeWebUrl } from "@/lib/utils/url";

export function JobUrlCell({
  value,
  readOnly = false,
  onCommit,
  onNavigateNext,
  onNavigatePrevious,
}: {
  value: string;
  readOnly?: boolean;
  onCommit: (value: string) => void;
  onNavigateNext?: () => void;
  onNavigatePrevious?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const compactLabel = formatJobUrlCompact(value);
  const hasSafeUrl = Boolean(value) && isSafeWebUrl(value);

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
    if (!value) {
      return <div className="min-h-8 px-1 py-1.5 text-sm text-muted">—</div>;
    }

    return (
      <div className="px-1 py-1.5">
        {hasSafeUrl ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full items-center gap-1 rounded-lg bg-default/40 px-1.5 py-1 text-[11px] text-muted transition-colors hover:text-accent"
            title={value}
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{compactLabel}</span>
          </a>
        ) : (
          <span className="text-[11px] text-muted">{compactLabel}</span>
        )}
      </div>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
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
        className="h-8 text-sm"
        aria-label="Job URL"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setIsEditing(true);
      }}
      className="flex min-h-8 w-full items-center rounded-lg px-1 py-1.5 transition-colors hover:bg-default/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
      title={value || "Add job URL"}
    >
      {value ? (
        <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-default/40 px-1.5 py-0.5">
          {hasSafeUrl ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open job URL"
              title={value}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted transition-colors hover:text-accent"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <ExternalLink className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
          )}
          <span className={cn("truncate text-[11px]", hasSafeUrl ? "text-foreground" : "text-muted")}>
            {compactLabel}
          </span>
        </span>
      ) : (
        <span className="text-[11px] text-muted">Add URL</span>
      )}
    </button>
  );
}
