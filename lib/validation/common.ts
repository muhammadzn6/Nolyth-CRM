import mongoose from "mongoose";
import { z } from "zod";

export const emailSchema = z.string().trim().email();

export const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => mongoose.isValidObjectId(value), "Invalid ObjectId");

export const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .min(1)
  .optional();

export const optionalNullableTrimmedStringSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional();

export const optionalUrlSchema = z.string().trim().url().optional();
