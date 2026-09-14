// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import { LanguageSwitcher } from "../LanguageSwitcher";

beforeEach(() => {
  void i18n.changeLanguage("en");
});

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("LanguageSwitcher", () => {
  it("renders EN and PL links", () => {
    renderWithI18n(<LanguageSwitcher currentLocale="en" />);
    expect(screen.getByTestId("lang-en")).toBeTruthy();
    expect(screen.getByTestId("lang-pl")).toBeTruthy();
  });

  it("marks the current locale link as active (en)", () => {
    renderWithI18n(<LanguageSwitcher currentLocale="en" />);
    const enLink = screen.getByTestId("lang-en");
    const plLink = screen.getByTestId("lang-pl");
    expect(enLink.className).toContain("bg-purple-600");
    expect(plLink.className).not.toContain("bg-purple-600");
  });

  it("marks the current locale link as active (pl)", () => {
    renderWithI18n(<LanguageSwitcher currentLocale="pl" />);
    const enLink = screen.getByTestId("lang-en");
    const plLink = screen.getByTestId("lang-pl");
    expect(plLink.className).toContain("bg-purple-600");
    expect(enLink.className).not.toContain("bg-purple-600");
  });

  it("submits a POST form to the locale-switch API endpoint", () => {
    renderWithI18n(<LanguageSwitcher currentLocale="en" />);
    const plButton = screen.getByTestId("lang-pl");
    const form = plButton.closest("form");
    if (!form) throw new Error("form element not found");
    expect(form.getAttribute("method")).toBe("post");
    expect(form.getAttribute("action")).toBe("/api/locale-switch");
    const localeInput = form.querySelector<HTMLInputElement>('input[name="locale"]');
    if (!localeInput) throw new Error("locale input not found");
    expect(localeInput.value).toBe("pl");
  });
});
