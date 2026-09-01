"use client";

import { SearchField as HeroSearchField } from "@heroui/react";

import { cn } from "@/lib/utils/cn";

export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  className,
  "aria-label": ariaLabel = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <HeroSearchField
      aria-label={ariaLabel}
      className={cn("min-w-[220px] flex-1", className)}
      value={value}
      onChange={onChange}
      variant="secondary"
    >
      <HeroSearchField.Group>
        <HeroSearchField.SearchIcon />
        <HeroSearchField.Input placeholder={placeholder} className="w-full" />
        <HeroSearchField.ClearButton />
      </HeroSearchField.Group>
    </HeroSearchField>
  );
}
