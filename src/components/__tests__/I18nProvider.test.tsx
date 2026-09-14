// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { I18nProvider } from "@/components/I18nProvider";

// Risk #7 (test-plan §2): "UI text not updating on language switch". The failure
// mode is stale text lingering in a mounted island after the locale changes. In
// production the locale reaches an island as a serializable `locale` prop (the
// server round-trips through /api/locale-switch and re-renders each island); the
// client-side reactive path lives in `I18nProvider` — a `useEffect` that calls
// `instance.changeLanguage(locale)` when the prop changes. This test drives that
// exact signal (a changed `locale` prop via RTL `rerender`) and asserts the
// visible text swaps, with no stale text left behind, and that it is reversible.
//
// `settings.title` is the visible-text oracle: "Settings" (en) / "Ustawienia" (pl).

// Minimal consumer so the test isolates I18nProvider reactivity — no real island
// (fetch, sonner, dialogs) to add noise unrelated to the reactivity mechanism.
function Probe() {
  const { t } = useTranslation("settings");
  return <p>{t("settings.title")}</p>;
}

describe("I18nProvider (Risk #7: UI text must update on language switch)", () => {
  it("swaps visible text on a locale-prop change and leaves no stale text (en→pl)", async () => {
    const { rerender } = render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );

    // Baseline: English is shown before the switch.
    expect(screen.getByText("Settings")).toBeTruthy();

    // Drive the switch through the same signal production uses: a changed prop.
    rerender(
      <I18nProvider locale="pl">
        <Probe />
      </I18nProvider>,
    );

    // changeLanguage resolves asynchronously and re-renders on the
    // `languageChanged` event, so the new text must be awaited.
    expect(await screen.findByText("Ustawienia")).toBeTruthy();

    // The heart of the risk: the old-locale text must be GONE, not merely
    // outnumbered by the new one.
    expect(screen.queryByText("Settings")).toBeNull();
  });

  it("is reversible on the same mounted instance (pl→en)", async () => {
    const { rerender } = render(
      <I18nProvider locale="pl">
        <Probe />
      </I18nProvider>,
    );

    expect(await screen.findByText("Ustawienia")).toBeTruthy();

    // Do NOT remount: `useState(() => cloneInstance(...))` runs its initializer
    // once, so rerendering keeps the same cloned instance and exercises the
    // useEffect reactivity path rather than a fresh mount.
    rerender(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeTruthy();
    });
    expect(screen.queryByText("Ustawienia")).toBeNull();
  });
});
