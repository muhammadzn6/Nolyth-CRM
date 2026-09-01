"use client";

import { ListBox, Select as HeroSelect } from "@heroui/react";

import { cn } from "@/lib/utils/cn";

export type SelectOption = {
  value: string;
  label: string;
};

const EMPTY_KEY = "__empty__";

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  variant = "secondary",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "secondary";
  "aria-label"?: string;
}) {
  const selectedKey = value || EMPTY_KEY;

  return (
    <HeroSelect
      aria-label={ariaLabel}
      className={cn("min-w-0", className)}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        const next = String(key ?? EMPTY_KEY);
        onChange(next === EMPTY_KEY ? "" : next);
      }}
      isDisabled={disabled}
      placeholder={placeholder}
      variant={variant}
      fullWidth
    >
      <HeroSelect.Trigger>
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover>
        <ListBox>
          {options.map((option) => {
            const id = option.value || EMPTY_KEY;
            return (
              <ListBox.Item key={id} id={id} textValue={option.label}>
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            );
          })}
        </ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
}
