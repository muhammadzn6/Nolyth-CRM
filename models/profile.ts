import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const ProfileSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    assignedBD: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedCloser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

ProfileSchema.index({ assignedBD: 1, isActive: 1 });
ProfileSchema.index({ assignedCloser: 1, isActive: 1 });

export type Profile = InferSchemaType<typeof ProfileSchema>;
export type ProfileDocument = Profile & { _id: Schema.Types.ObjectId };

export const ProfileModel =
  (models.Profile as Model<Profile> | undefined) ??
  model<Profile>("Profile", ProfileSchema);
