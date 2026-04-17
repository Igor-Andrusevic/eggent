export function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeTelegramUserId(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }
  const normalized = trimString(value);
  return /^-?\d+$/.test(normalized) ? normalized : "";
}

export function normalizeDate(value: unknown): string {
  const raw = trimString(value);
  if (!raw) return "";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString();
}
