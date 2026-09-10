import { z } from "zod";

import { uuidSchema } from "./common";
import { compensationPeriodSchema } from "./profiles";

const textSchema = z.string().trim().min(1);
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const urlSchema = z.string().trim().pipe(z.url());
const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i, "Invalid domain");
const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a three-letter ISO code");
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Compensation must be a non-negative decimal");
const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Invalid calendar date");
const queryBooleanSchema = z.union([
  z.boolean(),
  z.enum(["true", "false"]).transform((value) => value === "true"),
]);

export const leadStatusSchema = z.enum([
  "APPLIED",
  "RESPONSE_RECEIVED",
  "INTERVIEWING",
  "OFFER_RECEIVED",
  "OFFER_ACCEPTED",
  "PLACED",
  "STARTED",
  "CLOSED",
]);

export const leadContactRoleSchema = z.enum([
  "RECRUITER",
  "HR",
  "HIRING_MANAGER",
  "INTERVIEWER",
]);

export const companySummarySchema = z.strictObject({
  id: uuidSchema,
  canonicalName: textSchema,
  website: urlSchema.nullable(),
  domain: domainSchema.nullable(),
  industry: textSchema.nullable(),
  location: textSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().positive(),
});

export const createCompanySchema = z.strictObject({
  canonicalName: textSchema,
  website: urlSchema.optional(),
  domain: domainSchema.optional(),
  industry: textSchema.optional(),
  location: textSchema.optional(),
});

const companyUpdateShape = {
  canonicalName: textSchema.optional(),
  website: urlSchema.nullable().optional(),
  domain: domainSchema.nullable().optional(),
  industry: textSchema.nullable().optional(),
  location: textSchema.nullable().optional(),
};

export const updateCompanySchema = z
  .strictObject(companyUpdateShape)
  .refine((update) => Object.values(update).some((value) => value !== undefined), {
    message: "At least one company field must be provided",
  });

export const updateCompanyRequestSchema = z
  .strictObject({
    ...companyUpdateShape,
    expectedVersion: z.number().int().positive(),
  })
  .refine(
    ({ expectedVersion: _expectedVersion, ...update }) =>
      Object.values(update).some((value) => value !== undefined),
    { message: "At least one company field must be provided" },
  );

export const companyListQuerySchema = z.strictObject({
  search: textSchema.optional(),
  cursor: textSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const contactSummarySchema = z.strictObject({
  id: uuidSchema,
  companyId: uuidSchema,
  name: textSchema,
  title: textSchema.nullable(),
  email: emailSchema.nullable(),
  phone: textSchema.nullable(),
  linkedinUrl: urlSchema.nullable(),
  notes: textSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().positive(),
});

export const createContactSchema = z.strictObject({
  companyId: uuidSchema,
  name: textSchema,
  title: textSchema.optional(),
  email: emailSchema.optional(),
  phone: textSchema.optional(),
  linkedinUrl: urlSchema.optional(),
  notes: textSchema.optional(),
});

const contactUpdateShape = {
  name: textSchema.optional(),
  title: textSchema.nullable().optional(),
  email: emailSchema.nullable().optional(),
  phone: textSchema.nullable().optional(),
  linkedinUrl: urlSchema.nullable().optional(),
  notes: textSchema.nullable().optional(),
};

export const updateContactSchema = z
  .strictObject(contactUpdateShape)
  .refine((update) => Object.values(update).some((value) => value !== undefined), {
    message: "At least one contact field must be provided",
  });

export const updateContactRequestSchema = z
  .strictObject({
    ...contactUpdateShape,
    expectedVersion: z.number().int().positive(),
  })
  .refine(
    ({ expectedVersion: _expectedVersion, ...update }) =>
      Object.values(update).some((value) => value !== undefined),
    { message: "At least one contact field must be provided" },
  );

export const contactListQuerySchema = z.strictObject({
  companyId: uuidSchema,
  search: textSchema.optional(),
  cursor: textSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const optionalLeadFields = {
  description: textSchema.optional(),
  location: textSchema.optional(),
  workplaceType: textSchema.optional(),
  employmentType: textSchema.optional(),
  contractType: textSchema.optional(),
  compensationMin: moneySchema.optional(),
  compensationMax: moneySchema.optional(),
  compensationCurrency: currencySchema.optional(),
  compensationPeriod: compensationPeriodSchema.optional(),
};

function hasValidCompensationRange(value: {
  compensationMax?: string | null;
  compensationMin?: string | null;
}) {
  return (
    value.compensationMin == null ||
    value.compensationMax == null ||
    Number(value.compensationMin) <= Number(value.compensationMax)
  );
}

export const createLeadSchema = z
  .strictObject({
    profileId: uuidSchema,
    companyId: uuidSchema,
    currentOwnerId: uuidSchema,
    sourceId: uuidSchema,
    jobTitle: textSchema,
    rawUrl: urlSchema,
    appliedDate: dateSchema,
    ...optionalLeadFields,
  })
  .refine(hasValidCompensationRange, {
    message: "Compensation minimum cannot exceed compensation maximum",
    path: ["compensationMax"],
  });

export const createApplicationIntakeSchema = z.strictObject({
  profileId: uuidSchema,
  companyName: textSchema,
  jobTitle: textSchema,
  rawUrl: urlSchema,
  recruiterName: textSchema,
  recruiterEmail: emailSchema,
  compensationMin: moneySchema.optional(),
  compensationMax: moneySchema.optional(),
  compensationCurrency: currencySchema.optional(),
  compensationPeriod: compensationPeriodSchema.optional(),
  duplicateOverrideReason: textSchema.optional(),
}).refine(hasValidCompensationRange, {
  message: "Compensation minimum cannot exceed compensation maximum",
  path: ["compensationMax"],
});

const leadUpdateShape = {
  companyId: uuidSchema.optional(),
  sourceId: uuidSchema.optional(),
  jobTitle: textSchema.optional(),
  rawUrl: urlSchema.optional(),
  appliedDate: dateSchema.optional(),
  description: textSchema.nullable().optional(),
  location: textSchema.nullable().optional(),
  workplaceType: textSchema.nullable().optional(),
  employmentType: textSchema.nullable().optional(),
  contractType: textSchema.nullable().optional(),
  compensationMin: moneySchema.nullable().optional(),
  compensationMax: moneySchema.nullable().optional(),
  compensationCurrency: currencySchema.nullable().optional(),
  compensationPeriod: compensationPeriodSchema.nullable().optional(),
};

export const updateLeadSchema = z
  .strictObject(leadUpdateShape)
  .refine((update) => Object.values(update).some((value) => value !== undefined), {
    message: "At least one lead field must be provided",
  })
  .refine(hasValidCompensationRange, {
    message: "Compensation minimum cannot exceed compensation maximum",
    path: ["compensationMax"],
  });

export const updateLeadRequestSchema = z
  .strictObject({
    ...leadUpdateShape,
    expectedVersion: z.number().int().positive(),
  })
  .refine(
    ({ expectedVersion: _expectedVersion, ...update }) =>
      Object.values(update).some((value) => value !== undefined),
    { message: "At least one lead field must be provided" },
  )
  .refine(hasValidCompensationRange, {
    message: "Compensation minimum cannot exceed compensation maximum",
    path: ["compensationMax"],
  });

const leadRecordShape = {
  id: uuidSchema,
  profileId: uuidSchema,
  companyId: uuidSchema,
  sourceId: uuidSchema,
  createdById: uuidSchema,
  currentOwnerId: uuidSchema,
  responsibleCloserId: uuidSchema.nullable(),
  archivedById: uuidSchema.nullable(),
  closedById: uuidSchema.nullable(),
  jobTitle: textSchema,
  companyName: textSchema.optional(),
  description: textSchema.nullable(),
  rawUrl: urlSchema,
  canonicalUrl: urlSchema.nullable(),
  canonicalHash: textSchema.nullable(),
  location: textSchema.nullable(),
  workplaceType: textSchema.nullable(),
  employmentType: textSchema.nullable(),
  contractType: textSchema.nullable(),
  compensationMin: moneySchema.nullable(),
  compensationMax: moneySchema.nullable(),
  compensationCurrency: currencySchema.nullable(),
  compensationPeriod: compensationPeriodSchema.nullable(),
  appliedDate: dateSchema,
  status: leadStatusSchema,
  isImportant: z.boolean(),
  closureReason: textSchema.nullable(),
  closureNotes: textSchema.nullable(),
  closedAt: z.iso.datetime().nullable(),
  placedAt: z.iso.datetime().nullable(),
  startDate: dateSchema.nullable(),
  startedAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  archiveReason: textSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().positive(),
};

export const leadSummarySchema = z.strictObject(leadRecordShape);

export const applicationDuplicateStateSchema = z.strictObject({
  classification: z.enum(["NONE", "LIKELY", "CONFIRMED"]),
  qualifiedCredit: z.boolean(),
  reviewId: uuidSchema.nullable(),
});

export const applicationIntakeResultSchema = z.strictObject({
  lead: leadSummarySchema,
  duplicate: applicationDuplicateStateSchema,
});

export const leadContactSummarySchema = z.strictObject({
  id: uuidSchema,
  leadId: uuidSchema,
  contactId: uuidSchema,
  role: leadContactRoleSchema,
  isPrimary: z.boolean(),
  createdAt: z.iso.datetime(),
  contact: contactSummarySchema,
});

const leadCandidateIdentitySchema = z.strictObject({
  id: uuidSchema,
  firstName: textSchema,
  lastName: textSchema,
  preferredName: textSchema.nullable(),
});

const leadProfileIdentitySchema = z.strictObject({
  id: uuidSchema,
  name: textSchema,
  candidate: leadCandidateIdentitySchema,
});

const leadSourceIdentitySchema = z.strictObject({
  id: uuidSchema,
  name: textSchema,
});

const leadOwnerIdentitySchema = z.strictObject({
  id: uuidSchema,
  displayName: textSchema,
  email: emailSchema,
});

export const leadDetailSchema = z.strictObject({
  ...leadRecordShape,
  company: companySummarySchema,
  profile: leadProfileIdentitySchema,
  sourceRef: leadSourceIdentitySchema,
  currentOwner: leadOwnerIdentitySchema,
  responsibleCloser: leadOwnerIdentitySchema.nullable(),
  contacts: z.array(leadContactSummarySchema),
});

export const leadListQuerySchema = z
  .strictObject({
    profileId: uuidSchema.optional(),
    companyId: uuidSchema.optional(),
    sourceId: uuidSchema.optional(),
    ownerId: uuidSchema.optional(),
    closerId: uuidSchema.optional(),
    status: leadStatusSchema.optional(),
    pipelineStage: z.enum(["APPLIED", "ACTIVE", "INTERVIEW", "OFFER", "PLACEMENT"]).optional(),
    important: queryBooleanSchema.optional(),
    archived: queryBooleanSchema.default(false),
    appliedFrom: dateSchema.optional(),
    appliedTo: dateSchema.optional(),
    search: textSchema.optional(),
    cursor: textSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine(
    ({ appliedFrom, appliedTo }) =>
      appliedFrom === undefined || appliedTo === undefined || appliedFrom <= appliedTo,
    { message: "Applied from date cannot be after applied to date", path: ["appliedTo"] },
  );

export const leadStatusTransitionSchema = z
  .strictObject({
    toStatus: leadStatusSchema,
    reason: textSchema.optional(),
    expectedVersion: z.number().int().positive(),
  })
  .refine(({ reason, toStatus }) => toStatus !== "CLOSED" || reason !== undefined, {
    message: "Closing a lead requires a reason",
    path: ["reason"],
  });

export const transferLeadOwnershipSchema = z.strictObject({
  newOwnerId: uuidSchema,
  reason: textSchema,
  expectedVersion: z.number().int().positive(),
});

export const assignLeadCloserRequestSchema = z.strictObject({
  closerId: uuidSchema,
  expectedVersion: z.number().int().positive(),
});

export const setLeadImportantSchema = z.strictObject({
  important: z.boolean(),
  expectedVersion: z.number().int().positive(),
});

export const archiveLeadSchema = z.strictObject({
  reason: textSchema,
  expectedVersion: z.number().int().positive(),
});

export const restoreLeadSchema = z.strictObject({
  reason: textSchema,
  expectedVersion: z.number().int().positive(),
});

// Retained for callers of the foundation-era shared contract.
export const assignLeadCloserSchema = z.strictObject({
  leadId: uuidSchema,
  userId: uuidSchema,
});

export type LeadStatus = z.infer<typeof leadStatusSchema>;
export type LeadContactRole = z.infer<typeof leadContactRoleSchema>;
export type CompanySummary = z.infer<typeof companySummarySchema>;
export type CreateCompany = z.infer<typeof createCompanySchema>;
export type UpdateCompany = z.infer<typeof updateCompanySchema>;
export type UpdateCompanyRequest = z.infer<typeof updateCompanyRequestSchema>;
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;
export type ContactSummary = z.infer<typeof contactSummarySchema>;
export type CreateContact = z.infer<typeof createContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
export type UpdateContactRequest = z.infer<typeof updateContactRequestSchema>;
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;
export type CreateLead = z.infer<typeof createLeadSchema>;
export type CreateApplicationIntake = z.infer<typeof createApplicationIntakeSchema>;
export type ApplicationDuplicateState = z.infer<typeof applicationDuplicateStateSchema>;
export type ApplicationIntakeResult = z.infer<typeof applicationIntakeResultSchema>;
export type UpdateLead = z.infer<typeof updateLeadSchema>;
export type UpdateLeadRequest = z.infer<typeof updateLeadRequestSchema>;
export type LeadSummary = z.infer<typeof leadSummarySchema>;
export type LeadContactSummary = z.infer<typeof leadContactSummarySchema>;
export type LeadDetail = z.infer<typeof leadDetailSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export type LeadStatusTransition = z.infer<typeof leadStatusTransitionSchema>;
export type TransferLeadOwnership = z.infer<typeof transferLeadOwnershipSchema>;
export type AssignLeadCloserRequest = z.infer<typeof assignLeadCloserRequestSchema>;
export type SetLeadImportant = z.infer<typeof setLeadImportantSchema>;
export type ArchiveLead = z.infer<typeof archiveLeadSchema>;
export type RestoreLead = z.infer<typeof restoreLeadSchema>;
export type AssignLeadCloser = z.infer<typeof assignLeadCloserSchema>;
