"use client";

import { useState } from "react";

function jobHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Job description";
  }
}

export function JobLinkActions({ canonicalUrl, rawUrl }: { canonicalUrl: string | null; rawUrl: string }) {
  const href = canonicalUrl ?? rawUrl;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(href);
    setCopied(true);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <a
        aria-label="Open job description"
        className="min-w-0 truncate font-semibold text-primary hover:underline"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {jobHost(href)}
      </a>
      <button
        aria-label="Copy job description link"
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={() => void copyLink()}
        type="button"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
