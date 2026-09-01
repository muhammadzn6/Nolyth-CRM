"use client";

import type { ComponentProps } from "react";
import { Button as HeroButton } from "@heroui/react";

import { cn } from "@/lib/utils/cn";

type ButtonProps = Omit<ComponentProps<typeof HeroButton>, "variant"> & {
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
};

const variantMap = {
  primary: undefined,
  secondary: "secondary" as const,
  ghost: "ghost" as const,
};

export function Button({
  className,
  type = "button",
  variant = "primary",
  isDisabled,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <HeroButton
      type={type}
      variant={variantMap[variant]}
      isDisabled={isDisabled ?? disabled}
      className={cn(
        "font-medium",
        variant === "primary" && "bg-accent text-accent-foreground hover:opacity-90",
        className,
      )}
      {...props}
    >
      {children}
    </HeroButton>
  );
}
