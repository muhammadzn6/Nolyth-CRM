import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { AuthorizationError, CandidatesService, LeadsService, type Actor, ValidationError } from "@orbit/backend";
import { bulkImportRequestSchema } from "@orbit/contracts";
import { IdentityGuard, type AuthenticatedRequest } from "../identity/identity.guard";

function parseRecords(csv: string): string[][] {
  const result: string[][] = []; let record: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < csv.length; index += 1) { const character = csv[index];
    if (character === '"') { if (quoted && csv[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (character === "," && !quoted) { record.push(cell.trim()); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && csv[index + 1] === "\n") index += 1; record.push(cell.trim()); cell = ""; if (record.some((value) => value !== "")) result.push(record); record = []; }
    else cell += character;
  }
  if (quoted) throw new ValidationError("CSV contains an unterminated quoted field");
  record.push(cell.trim()); if (record.some((value) => value !== "")) result.push(record); return result;
}

function parseCsv(csv: string): Array<{ row: number; values: Record<string, string> }> {
  const [headerRow, ...dataRows] = parseRecords(csv);
  if (!headerRow?.length) throw new ValidationError("CSV must include a header row");
  const headers = headerRow.map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
  if (headers.some((header) => !header)) throw new ValidationError("CSV contains an empty header");
  if (new Set(headers).size !== headers.length) throw new ValidationError("CSV contains a duplicate header");
  if (dataRows.length > 1000) throw new ValidationError("CSV must contain 1,000 rows or fewer");
  return dataRows.map((values, index) => ({ row: index + 2, values: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])) }));
}

@Controller("imports")
@UseGuards(IdentityGuard)
export class ImportsController {
  constructor(@Inject(LeadsService) private readonly leads: LeadsService, @Inject(CandidatesService) private readonly candidates: CandidatesService) {}
  @Post("candidates") async candidatesImport(@Body() input: unknown, @Req() request: AuthenticatedRequest) { return this.run(request.actor, input, (actor, values) => this.candidates.createCandidate(actor, { firstName: values.first_name, lastName: values.last_name, ...(values.email ? { email: values.email } : {}), timezone: values.timezone || "UTC", ...(values.phone ? { phone: values.phone } : {}), ...(values.location ? { location: values.location } : {}) })); }
  @Post("leads") async leadsImport(@Body() input: unknown, @Req() request: AuthenticatedRequest) { return this.run(request.actor, input, (actor, values) => this.leads.create(actor, { profileId: values.profile_id, companyId: values.company_id, currentOwnerId: values.current_owner_id, sourceId: values.source_id, jobTitle: values.job_title, rawUrl: values.raw_url, appliedDate: values.applied_date })); }
  private async run(actor: Actor | undefined, input: unknown, create: (actor: Actor, values: Record<string, string>) => Promise<unknown>) {
    if (!actor || actor.role !== "ADMIN" || !actor.isActive) throw new AuthorizationError();
    const parsed = bulkImportRequestSchema.safeParse(input); if (!parsed.success) throw new ValidationError("The request payload is invalid", parsed.error.issues);
    const rows = parseCsv(parsed.data.csv); const errors: Array<{ row: number; message: string }> = []; let imported = 0;
    for (const row of rows) { try { await create(actor, row.values); imported += 1; } catch (cause) { errors.push({ row: row.row, message: cause instanceof Error ? cause.message : "Row could not be imported." }); } }
    return { imported, failed: errors.length, errors };
  }
}
