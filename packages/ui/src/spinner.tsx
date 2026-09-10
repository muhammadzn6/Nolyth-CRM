import type { ComponentProps } from "react";

import { joinClasses } from "./styles";

type OrbitSpinnerProps = Omit<ComponentProps<"span">, "children"> & {
  size?: "sm" | "md" | "lg" | "xl";
};

const sizes = {
  sm: "size-4",
  md: "size-6",
  lg: "size-10",
  xl: "size-24",
};

export function OrbitSpinner({ className, size = "md", ...props }: OrbitSpinnerProps) {
  const compact = size === "sm";

  return (
    <span
      aria-hidden="true"
      className={joinClasses("relative inline-grid shrink-0 place-items-center", sizes[size], className)}
      data-orbit-spinner="true"
      {...props}
    >
      <span className="absolute inset-0 rounded-full border-2 border-current opacity-15" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-current border-t-current motion-reduce:animate-none" />
      {!compact ? <span className="absolute inset-[18%] animate-spin rounded-full border border-current border-b-transparent opacity-55 motion-reduce:animate-none" style={{ animationDirection: "reverse", animationDuration: "1.6s" }} /> : null}
      {!compact ? <span className="absolute left-1/2 top-0 size-[12%] -translate-x-1/2 rounded-full bg-current shadow-[0_0_18px_currentColor]" /> : null}
      <span className="size-[22%] rounded-full bg-current opacity-75 shadow-[0_0_22px_currentColor]" />
    </span>
  );
}
