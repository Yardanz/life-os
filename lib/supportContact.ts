export const LIFEOS_SUPPORT_EMAIL = "lifeossupport@gmail.com";

export function getSupportEmail(): string {
  return LIFEOS_SUPPORT_EMAIL;
}

export function getSupportMailto(subject?: string): string {
  if (!subject) {
    return `mailto:${LIFEOS_SUPPORT_EMAIL}`;
  }
  return `mailto:${LIFEOS_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
