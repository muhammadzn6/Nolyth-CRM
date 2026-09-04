import type { ComponentProps } from "react";

import { joinClasses } from "./styles";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(49,93,204,0.18)] hover:bg-primary-hover disabled:bg-primary/50",
  secondary:
    "border border-border bg-surface text-foreground shadow-[0_4px_12px_rgba(35,42,58,0.04)] hover:bg-surface-subtle",
  ghost: "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
  danger: "bg-danger text-white shadow-[0_8px_18px_rgba(194,65,59,0.16)] hover:bg-danger/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-full px-3.5 text-xs",
  md: "h-10 gap-2 rounded-full px-5 text-sm",
  icon: "size-10 rounded-full",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={joinClasses(
        "inline-flex shrink-0 items-center justify-center font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none",
        variants[variant],
        sizes[size],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
