import Image from "next/image";

import { cn } from "@/lib/utils/cn";

const LOGO_SRC = "/orbit-logo-transparent.png";
const LOGO_WIDTH = 7594;
const LOGO_HEIGHT = 1089;
const LOGO_ASPECT = LOGO_WIDTH / LOGO_HEIGHT;
/** Approximate width of the O mark relative to the full wordmark. */
const MARK_WIDTH_RATIO = 0.18;

export function OrbitLogo({
  className,
  height = 24,
  showWordmark = false,
  markOnly = false,
}: {
  className?: string;
  height?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  markOnly?: boolean;
}) {
  const isMark = markOnly || !showWordmark;

  if (isMark) {
    const markWidth = height * LOGO_ASPECT * MARK_WIDTH_RATIO;

    return (
      <div
        className={cn("relative shrink-0 overflow-hidden", className)}
        style={{ height, width: markWidth }}
      >
        <Image
          src={LOGO_SRC}
          alt="Orbit"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          priority
          className="absolute left-0 top-0 max-w-none object-left object-contain"
          style={{ height, width: height * LOGO_ASPECT }}
        />
      </div>
    );
  }

  return (
    <Image
      src={LOGO_SRC}
      alt="Orbit"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority
      className={cn("shrink-0 object-contain", className)}
      style={{ height, width: height * LOGO_ASPECT }}
    />
  );
}
