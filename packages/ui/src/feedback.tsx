import type { ReactNode } from "react";

import { Button } from "./button";
import { joinClasses } from "./styles";

type FeedbackStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  tone?: "neutral" | "danger" | "warning";
  actionLabel?: string;
  onAction?: () => void;
};

const toneClasses = {
  neutral: "bg-info-soft text-info",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning-foreground",
};

function FeedbackIcon({ kind }: { kind: "empty" | "error" | "lock" }) {
  if (kind === "lock") {
    return (
      <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
        <path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "error") {
    return (
      <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
        <path d="M12 8v5m0 3.5v.01M10.3 4.4 3.6 17a2 2 0 0 0 1.8 3h13.2a2 2 0 0 0 1.8-3L13.7 4.4a1.93 1.93 0 0 0-3.4 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5v-9Zm0 0 7 3.5m7-3.5L12 11m0 9v-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function FeedbackState({
  title,
  description,
  icon,
  tone = "neutral",
  actionLabel,
  onAction,
}: FeedbackStateProps) {
  return (
    <div
      className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center"
      role={tone === "danger" ? "alert" : undefined}
    >
      <span className={joinClasses("mb-4 grid size-10 place-items-center rounded-xl", toneClasses[tone])}>
        {icon}
      </span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {actionLabel ? (
        <Button className="mt-5" onClick={onAction} variant={tone === "danger" ? "secondary" : "primary"}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, description }: Pick<FeedbackStateProps, "title" | "description">) {
  return <FeedbackState description={description} icon={<FeedbackIcon kind="empty" />} title={title} />;
}

export function ErrorState(props: Omit<FeedbackStateProps, "icon" | "tone">) {
  return <FeedbackState {...props} icon={<FeedbackIcon kind="error" />} tone="danger" />;
}

export function UnauthorizedState({
  description = "Your current role does not have permission to view this page.",
}: {
  description?: string;
}) {
  return (
    <FeedbackState
      description={description}
      icon={<FeedbackIcon kind="lock" />}
      title="Access restricted"
      tone="warning"
    />
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div aria-live="polite" aria-busy="true" className="grid gap-5">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-surface motion-reduce:animate-none" key={item} />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-border bg-surface motion-reduce:animate-none" />
    </div>
  );
}
