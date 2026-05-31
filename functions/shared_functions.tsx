export function formatPhoneNumber(value: string): string {
  if (!value) return "";

  const digits = value.replace(/^\+1/, "").replace(/\D/g, "");
  const trimmed = digits.substring(0, 10);

  if (trimmed.length < 4) return trimmed;
  if (trimmed.length < 7) return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3)}`;
  return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3, 6)}-${trimmed.slice(6)}`;
}