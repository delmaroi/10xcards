import { describe, it, expect } from "vitest";
import enCommon from "../locales/en/common.json";
import plCommon from "../locales/pl/common.json";
import enAuth from "../locales/en/auth.json";
import plAuth from "../locales/pl/auth.json";
import enSettings from "../locales/en/settings.json";
import plSettings from "../locales/pl/settings.json";
import enDashboard from "../locales/en/dashboard.json";
import plDashboard from "../locales/pl/dashboard.json";

function getKeys(obj: Record<string, string>): string[] {
  return Object.keys(obj);
}

describe("i18n translation completeness", () => {
  function checkLocalePair(en: Record<string, string>, pl: Record<string, string>, ns: string) {
    const enKeys = getKeys(en);
    const plKeys = getKeys(pl);

    const missingInPl = enKeys.filter((k) => !plKeys.includes(k));
    const missingInEn = plKeys.filter((k) => !enKeys.includes(k));

    if (missingInPl.length > 0) {
      console.error(`Missing in pl/${ns}.json:`, missingInPl);
    }
    if (missingInEn.length > 0) {
      console.error(`Missing in en/${ns}.json:`, missingInEn);
    }

    expect(missingInPl, `Keys missing in pl/${ns}.json`).toEqual([]);
    expect(missingInEn, `Keys missing in en/${ns}.json`).toEqual([]);
  }

  it("common namespace has matching keys in both locales", () => {
    checkLocalePair(enCommon, plCommon, "common");
  });

  it("auth namespace has matching keys in both locales", () => {
    checkLocalePair(enAuth, plAuth, "auth");
  });

  it("settings namespace has matching keys in both locales", () => {
    checkLocalePair(enSettings, plSettings, "settings");
  });

  it("dashboard namespace has matching keys in both locales", () => {
    checkLocalePair(enDashboard, plDashboard, "dashboard");
  });
});
