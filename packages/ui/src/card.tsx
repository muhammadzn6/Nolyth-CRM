import type { ComponentProps } from "react";

import { joinClasses } from "./styles";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={joinClasses(
        "rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgba(23,35,56,0.03)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"header">) {
  return <header className={joinClasses("flex items-start justify-between gap-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2 className={joinClasses("text-sm font-semibold tracking-[-0.01em] text-foreground", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={joinClasses("text-sm leading-6 text-muted-foreground", className)} {...props} />;
}
