import type { ReactNode } from "react";

import { Button } from "./button";
import { OrbitSpinner } from "./spinner";
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
      className="flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-surface px-6 py-10 text-center shadow-[0_8px_24px_rgba(35,42,58,0.03)]"
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
    <div aria-live="polite" aria-busy="true" className="fixed inset-0 z-[100] grid place-items-center bg-background/80 px-6 backdrop-blur-[6px]" data-orbit-page-loader="true" role="status">
      <div className="relative isolate flex w-full max-w-sm flex-col items-center overflow-hidden rounded-[2rem] border border-[#efd4ca] bg-[radial-gradient(circle_at_50%_18%,#fff_0%,#fff8f4_48%,#fbe6de_100%)] px-8 py-10 text-center shadow-[0_28px_80px_rgba(94,48,34,0.16)]">
        <span aria-hidden="true" className="absolute -left-16 -top-20 -z-10 size-52 rounded-full border-[30px] border-white/55" />
        <span aria-hidden="true" className="absolute -bottom-24 -right-16 -z-10 size-56 rounded-full border-[34px] border-[#f6c8b8]/35" />
        <span className="relative grid size-32 place-items-center" aria-hidden="true">
          <span className="absolute inset-1 rounded-full bg-action/10 blur-xl" />
          <OrbitSpinner className="text-action" size="xl" />
          <span className="absolute inset-[38%] rounded-full bg-surface shadow-[0_6px_18px_rgba(117,48,29,0.18)]" />
        </span>
        <strong className="mt-5 text-base font-bold tracking-[-0.02em] text-foreground">{label}</strong>
        <span className="mt-2 max-w-64 text-sm leading-6 text-muted-foreground">Aligning your workspace and latest activity.</span>
      </div>
    </div>
  );
}
