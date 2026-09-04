export type ParsedCsvRow = { row: number; values: Record<string, string> };
export type ParsedCsv = { headers: string[]; rows: ParsedCsvRow[] };

function records(input: string): string[][] {
  const result: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { record.push(cell.trim()); cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      record.push(cell.trim()); cell = "";
      if (record.some((value) => value !== "")) result.push(record);
      record = [];
    } else cell += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  record.push(cell.trim());
  if (record.some((value) => value !== "")) result.push(record);
  return result;
}

export function parseCsv(input: string): ParsedCsv {
  if (input.length > 5 * 1024 * 1024) throw new Error("CSV must be 5 MB or smaller");
  const [headerRow, ...dataRows] = records(input);
  if (!headerRow?.length) throw new Error("CSV must include a header row");
  const headers = headerRow.map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
  if (headers.some((header) => !header)) throw new Error("CSV contains an empty header");
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains a duplicate header");
  if (dataRows.length > 1000) throw new Error("CSV must contain 1,000 rows or fewer");
  return { headers, rows: dataRows.map((values, index) => ({ row: index + 2, values: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])) })) };
}
