export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildCaseInsensitiveRegex(value: string): RegExp {
  return new RegExp(escapeRegex(value.trim()), "i");
}
