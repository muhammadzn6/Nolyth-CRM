"use client";

import type { ComponentProps } from "react";
import { TextArea as HeroTextArea } from "@heroui/react";

import { cn } from "@/lib/utils/cn";

type TextAreaProps = ComponentProps<typeof HeroTextArea>;

export function TextArea({
  className,
  variant = "secondary",
  fullWidth = true,
  ...props
}: TextAreaProps) {
  return (
    <HeroTextArea
      variant={variant}
      fullWidth={fullWidth}
      className={cn(className)}
      {...props}
    />
  );
}
