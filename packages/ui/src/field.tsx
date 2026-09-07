import type { ComponentProps, ReactNode } from "react";

import { joinClasses } from "./styles";

export type FieldProps = ComponentProps<"div"> & {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  ...props
}: FieldProps) {
  return (
    <div className={joinClasses("grid gap-2", className)} {...props}>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold text-foreground" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-danger" id={`${htmlFor}-error`}>
          <span aria-hidden="true">●</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={joinClasses(
        "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-focus/15 disabled:cursor-not-allowed disabled:bg-surface-subtle motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
