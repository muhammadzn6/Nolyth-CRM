"use client";

import type { ComponentProps } from "react";
import { Input as HeroInput } from "@heroui/react";

import { cn } from "@/lib/utils/cn";

type InputProps = ComponentProps<typeof HeroInput>;

export function Input({
  className,
  variant = "secondary",
  fullWidth = true,
  ...props
}: InputProps) {
  return (
    <HeroInput
      variant={variant}
      fullWidth={fullWidth}
      className={cn(className)}
      {...props}
    />
  );
}
