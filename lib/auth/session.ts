import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/config";
import { connectToDatabase } from "@/lib/db/mongoose";
import { assertAuthConfigured } from "@/lib/env";
import { AuthenticationError } from "@/lib/errors/app-error";
import { UserModel } from "@/models/user";
import type { AppActor } from "@/types/auth";

export async function getSessionActor(): Promise<AppActor | null> {
  assertAuthConfigured();
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.email || !session.user.name || !session.user.role) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    isActive: session.user.isActive,
  };
}

export async function requireUser() {
  const actor = await getSessionActor();

  if (!actor) {
    throw new AuthenticationError();
  }

  return actor;
}

export async function requireActiveUser() {
  const actor = await requireUser();
  await connectToDatabase();

  const currentUser = await UserModel.findById(actor.id);

  if (!currentUser || !currentUser.isActive) {
    throw new AuthenticationError("Your account is inactive");
  }

  return {
    id: currentUser._id.toString(),
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.role,
    isActive: currentUser.isActive,
  } satisfies AppActor;
}
