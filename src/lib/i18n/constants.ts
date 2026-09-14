export const SUPPORTED_LOCALES = ["en", "pl"] as const;
export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "preferred-locale";

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isValidLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
