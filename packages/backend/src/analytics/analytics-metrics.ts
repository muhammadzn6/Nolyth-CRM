type ResponseTransition = { lead?: { appliedDate?: Date | string | null }; occurredAt?: Date | string | null };

export function averageResponseTimeHours(rows: readonly ResponseTransition[]): number | null {
  const hours = rows.flatMap((row) => {
    if (!row.lead?.appliedDate || !row.occurredAt) return [];
    const elapsed = (new Date(row.occurredAt).getTime() - new Date(row.lead.appliedDate).getTime()) / 3_600_000;
    return elapsed >= 0 ? [elapsed] : [];
  });
  if (!hours.length) return null;
  return Math.round((hours.reduce((total, value) => total + value, 0) / hours.length) * 10) / 10;
}
