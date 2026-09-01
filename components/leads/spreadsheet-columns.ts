export const SPREADSHEET_COLUMN_DEFS = [
  { id: "important", label: "Important", width: "1.25rem" },
  { id: "applied", label: "Applied", width: "8.5%" },
  { id: "company", label: "Company", width: "16%" },
  { id: "jobTitle", label: "Job Title", width: "15%" },
  { id: "jobUrl", label: "Job URL", width: "10%" },
  { id: "rate", label: "Rate", width: "7%" },
  { id: "unit", label: "Unit", width: "8%" },
  { id: "status", label: "Status", width: "11%" },
  { id: "rounds", label: "Rounds", width: "9%" },
  { id: "save", label: "Save", width: "7.5%" },
] as const;

export const SPREADSHEET_COLUMNS = SPREADSHEET_COLUMN_DEFS.map((column) => column.label);

export const SPREADSHEET_COLUMN_COUNT = SPREADSHEET_COLUMN_DEFS.length;

export const SPREADSHEET_CELL_CLASS = "px-1.5 py-1.5 align-top";

export const IMPORTANT_CELL_PADDING = "px-0 py-1.5 align-top text-center";

export const IMPORTANT_COLUMN_CLASS =
  "sticky left-0 z-[2] shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]";

export const IMPORTANT_HEADER_CLASS = `${IMPORTANT_COLUMN_CLASS} z-20 bg-surface-secondary/95 backdrop-blur-sm`;

export const IMPORTANT_CELL_CLASS = `${IMPORTANT_COLUMN_CLASS} bg-surface group-hover:bg-[color-mix(in_oklab,var(--default)_30%,var(--surface))]`;

export const IMPORTANT_ENTRY_CLASS = `${IMPORTANT_COLUMN_CLASS} bg-[color-mix(in_oklab,var(--accent-soft)_20%,var(--surface))]`;
