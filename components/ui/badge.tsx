import type { ComponentProps } from "react";
import { Chip } from "@heroui/react";

import { cn } from "@/lib/utils/cn";

type BadgeProps = Omit<ComponentProps<typeof Chip>, "color" | "variant"> & {
  variant?: "neutral" | "accent" | "success" | "warning" | "danger";
};

const variantMap = {
  neutral: "default",
  accent: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
} as const;

export function Badge({
  className,
  variant = "neutral",
  children,
  ...props
}: BadgeProps) {
  return (
    <Chip
      size="sm"
      variant="soft"
      color={variantMap[variant]}
      className={cn("h-auto px-2.5 py-1 text-xs font-medium", className)}
      {...props}
    >
      {children}
    </Chip>
  );
}
