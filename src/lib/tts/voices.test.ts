import { describe, it, expect } from "vitest";
import { SUPPORTED_VOICES, DEFAULT_VOICE, isValidVoice, getVoiceById } from "./voices";

describe("voices catalog", () => {
  it("DEFAULT_VOICE is the first entry and an en-US voice", () => {
    expect(DEFAULT_VOICE).toBe(SUPPORTED_VOICES[0].id);
    expect(SUPPORTED_VOICES[0].languageCode).toBe("en-US");
  });

  it("isValidVoice(DEFAULT_VOICE) is true", () => {
    expect(isValidVoice(DEFAULT_VOICE)).toBe(true);
  });

  it("isValidVoice rejects unknown ids", () => {
    expect(isValidVoice("not-a-voice")).toBe(false);
    expect(isValidVoice("")).toBe(false);
  });

  it("getVoiceById round-trips every catalog entry", () => {
    for (const voice of SUPPORTED_VOICES) {
      expect(getVoiceById(voice.id)).toEqual(voice);
    }
  });

  it("getVoiceById returns undefined for unknown ids", () => {
    expect(getVoiceById("not-a-voice")).toBeUndefined();
  });

  it("every entry has a non-empty gcpVoice and languageCode; ids are unique", () => {
    const ids = new Set<string>();
    for (const voice of SUPPORTED_VOICES) {
      expect(voice.gcpVoice.length).toBeGreaterThan(0);
      expect(voice.languageCode.length).toBeGreaterThan(0);
      expect(ids.has(voice.id)).toBe(false);
      ids.add(voice.id);
    }
  });
});
