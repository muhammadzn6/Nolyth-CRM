"use client";

import { ErrorState } from "@orbit/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-background p-6"><div className="w-full max-w-2xl"><ErrorState actionLabel="Try again" description="Orbit could not load this workspace. Your changes have not been lost." onAction={reset} title="Dashboard unavailable" /></div></main>;
}
