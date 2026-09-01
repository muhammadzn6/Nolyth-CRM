import type { Role } from "@/constants/roles";
import { ROLE_LABELS } from "@/constants/roles";

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRole(role: Role) {
  return ROLE_LABELS[role];
}

export function formatRate(rateAmount?: number | null, rateUnit?: string | null) {
  if (!rateAmount || !rateUnit) {
    return "—";
  }

  return rateUnit === "HOURLY"
    ? `$${rateAmount}/hr`
    : `$${rateAmount}/year`;
}

export function formatAverageRate(amount: number | null, rateUnit: "HOURLY" | "YEARLY") {
  if (amount === null) {
    return "—";
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: rateUnit === "HOURLY" ? 2 : 0,
  }).format(amount);

  return rateUnit === "HOURLY" ? `${formatted}/hr` : `${formatted}/yr`;
}

export function formatRelativeTime(value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);
  const diffMs = date.getTime() - Date.now();
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absSeconds < 60) {
    return formatter.format(Math.round(diffMs / 1000), "second");
  }

  const absMinutes = Math.round(absSeconds / 60);
  if (absMinutes < 60) {
    return formatter.format(Math.round(diffMs / (60 * 1000)), "minute");
  }

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) {
    return formatter.format(Math.round(diffMs / (60 * 60 * 1000)), "hour");
  }

  const absDays = Math.round(absHours / 24);
  if (absDays < 7) {
    return formatter.format(Math.round(diffMs / (24 * 60 * 60 * 1000)), "day");
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}
