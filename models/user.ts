import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { ROLES } from "@/constants/roles";

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

UserSchema.index({ email: 1 }, { unique: true });

export type User = InferSchemaType<typeof UserSchema>;
export type UserDocument = User & { _id: Schema.Types.ObjectId };

export const UserModel =
  (models.User as Model<User> | undefined) ?? model<User>("User", UserSchema);
