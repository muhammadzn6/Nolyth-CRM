import { Types } from "mongoose";

import type { Role } from "@/constants/roles";
import { AuthorizationError, NotFoundError } from "@/lib/errors/app-error";
import type { Profile } from "@/models/profile";
import type { AppActor } from "@/types/auth";

export const ADMIN_ONLY_ROLES: Role[] = ["ADMIN"];
export const LEAD_CREATOR_ROLES: Role[] = ["ADMIN", "BD"];
export const LEAD_EDITOR_ROLES: Role[] = ["ADMIN", "BD", "CLOSER"];

export function isAdmin(actor: AppActor) {
  return actor.role === "ADMIN";
}

export function requireAdmin(actor: AppActor) {
  if (!isAdmin(actor)) {
    throw new AuthorizationError();
  }
}

export function canCreateLead(actor: AppActor) {
  return LEAD_CREATOR_ROLES.includes(actor.role);
}

export function requireLeadCreatePermission(actor: AppActor) {
  if (!canCreateLead(actor)) {
    throw new AuthorizationError("You do not have permission to create leads");
  }
}

export function requireLeadEditPermission(actor: AppActor) {
  if (!LEAD_EDITOR_ROLES.includes(actor.role)) {
    throw new AuthorizationError("You do not have permission to update leads");
  }
}

function idsMatch(left: Types.ObjectId | string, right: string) {
  return left.toString() === right;
}

export function canAccessProfile(profile: Pick<Profile, "assignedBD" | "assignedCloser">, actor: AppActor) {
  if (isAdmin(actor)) {
    return true;
  }

  if (actor.role === "BD") {
    return idsMatch(profile.assignedBD, actor.id);
  }

  if (actor.role === "CLOSER") {
    return idsMatch(profile.assignedCloser, actor.id);
  }

  return false;
}

export function requireProfileAccess(
  profile: Pick<Profile, "assignedBD" | "assignedCloser">,
  actor: AppActor,
) {
  if (!canAccessProfile(profile, actor)) {
    throw new NotFoundError();
  }
}
