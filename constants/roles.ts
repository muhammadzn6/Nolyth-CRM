export const ROLES = ["ADMIN", "BD", "CLOSER"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  BD: "BD",
  CLOSER: "Closer",
};
