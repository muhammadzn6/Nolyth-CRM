import { requireAdmin } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongoose";
import { runInTransaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors/app-error";
import { hashPassword } from "@/lib/auth/password";
import { createUserSchema } from "@/lib/validation/users";
import { UserModel } from "@/models/user";
import type { AppActor } from "@/types/auth";

import { recordActivityEvent } from "@/services/activity-service";

export async function listUsers(actor: AppActor) {
  requireAdmin(actor);
  await connectToDatabase();

  return UserModel.find().sort({ createdAt: -1 });
}

export async function createUser(
  input: unknown,
  actor: AppActor,
) {
  requireAdmin(actor);
  await connectToDatabase();

  const parsed = createUserSchema.parse(input);
  const existingUser = await UserModel.findOne({
    email: parsed.email.toLowerCase(),
  });

  if (existingUser) {
    throw new ConflictError("A user with that email already exists");
  }

  const passwordHash = await hashPassword(parsed.password);

  const user = await runInTransaction(async (session) => {
    const createdUsers = await UserModel.create(
      [
        {
          name: parsed.name,
          email: parsed.email.toLowerCase(),
          passwordHash,
          role: parsed.role,
          isActive: parsed.isActive ?? true,
        },
      ],
      { session: session ?? undefined },
    );

    const createdUser = createdUsers[0];

    await recordActivityEvent(
      {
        actor,
        entityType: "USER",
        entityId: createdUser._id.toString(),
        action: "USER_CREATED",
        newValue: {
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          isActive: createdUser.isActive,
        },
      },
      session,
    );

    return createdUser;
  });

  return user;
}
