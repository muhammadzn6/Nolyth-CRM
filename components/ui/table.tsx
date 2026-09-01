import type { HTMLAttributes, TableHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export function Table({
  className,
  bare = false,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { bare?: boolean }) {
  const table = (
    <table
      className={cn("min-w-full border-separate border-spacing-0 text-left text-sm", className)}
      {...props}
    />
  );

  if (bare) {
    return table;
  }

  return <div className="overflow-x-auto">{table}</div>;
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface-secondary/80", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("bg-surface", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-default/35",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({
  className,
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 align-top text-foreground", className)} {...props} />;
}
