import type { ReactNode } from "react";

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-2 md:flex-row md:items-end md:justify-between">
      <h1 className="orbit-heading text-foreground">{title}</h1>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
