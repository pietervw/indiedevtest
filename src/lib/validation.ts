const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= 254 && EMAIL_RE.test(email);
}
