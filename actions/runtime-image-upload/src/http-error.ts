export function safeLiskovErrorDetail(parsed: unknown): string {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return "";
  const response = parsed as Record<string, unknown>;
  const code = safeField(response.error, 80);
  const reason = safeField(response.reason, 160);
  if (code && reason) return ` (${code}: ${reason})`;
  if (code) return ` (${code})`;
  return "";
}

function safeField(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return "";
  return /^[A-Za-z0-9_./: -]+$/u.test(value) ? value : "";
}
