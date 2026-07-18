const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL_RE = /^https?:\/\//i;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= 254 && EMAIL_RE.test(email);
}

/** True for http(s) URLs (scheme check only — not full URL validation). */
export function isHttpUrl(value: string): boolean {
  return HTTP_URL_RE.test(value);
}

/** Trimmed string field from FormData ("" when absent). */
export function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
