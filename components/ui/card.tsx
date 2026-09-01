import type { HTMLAttributes, ReactNode } from "react";
import { Card as HeroCard } from "@heroui/react";

import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <HeroCard
      variant="transparent"
      className={cn("rounded-2xl bg-surface shadow-none", className)}
      {...props}
    >
      {children}
    </HeroCard>
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
