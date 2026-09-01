import { Skeleton as HeroSkeleton } from "@heroui/react";

import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <HeroSkeleton className={cn("rounded-xl", className)} />;
}
