const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= 254 && EMAIL_RE.test(email);
}

/** True for parseable http(s) URLs with a host (rejects bare `https://`). */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.host)
    );
  } catch {
    return false;
  }
}

/** Trimmed string field from FormData ("" when absent). */
export function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
