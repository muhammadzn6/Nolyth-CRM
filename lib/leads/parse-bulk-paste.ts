const MAX_BULK_ROWS = 50;
const MAX_COLUMNS = 6;

export type ParsedBulkLeadRow = {
  companyName: string;
  jobTitle?: string;
  jobUrl: string;
};

export function parseBulkPaste(text: string): ParsedBulkLeadRow[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_BULK_ROWS);

  const parsed: ParsedBulkLeadRow[] = [];

  for (const row of rows) {
    const cells = row.split("\t").map((cell) => cell.trim()).filter((cell, index, all) => {
      return cell.length > 0 || index < all.length;
    });

    if (cells.length === 0) {
      continue;
    }

    if (cells.length > MAX_COLUMNS) {
      continue;
    }

    let companyName = "";
    let jobTitle: string | undefined;
    let jobUrl = "";

    if (cells.length >= 3) {
      [companyName, jobTitle, jobUrl] = cells;
    } else if (cells.length === 2) {
      [companyName, jobUrl] = cells;
    } else {
      continue;
    }

    if (!companyName || !jobUrl) {
      continue;
    }

    parsed.push({
      companyName,
      jobTitle: jobTitle || undefined,
      jobUrl,
    });
  }

  return parsed;
}
