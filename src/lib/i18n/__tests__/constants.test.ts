import { describe, it, expect } from "vitest";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, isValidLocale } from "../constants";

describe("i18n constants", () => {
  it("SUPPORTED_LOCALES contains en and pl", () => {
    expect(SUPPORTED_LOCALES).toContain("en");
    expect(SUPPORTED_LOCALES).toContain("pl");
    expect(SUPPORTED_LOCALES).toHaveLength(2);
  });

  it("DEFAULT_LOCALE is en", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("LOCALE_COOKIE is preferred-locale", () => {
    expect(LOCALE_COOKIE).toBe("preferred-locale");
  });
});

describe("isValidLocale", () => {
  it("returns true for supported locales", () => {
    expect(isValidLocale("en")).toBe(true);
    expect(isValidLocale("pl")).toBe(true);
  });

  it("returns false for unsupported locales", () => {
    expect(isValidLocale("de")).toBe(false);
    expect(isValidLocale("fr")).toBe(false);
    expect(isValidLocale("")).toBe(false);
    expect(isValidLocale("EN")).toBe(false);
  });

  it("returns false for locale with region code", () => {
    expect(isValidLocale("en-US")).toBe(false);
    expect(isValidLocale("pl-PL")).toBe(false);
  });
});
