import { describe, it, expect } from "vitest";
import { isAdmin } from "@/lib/is-admin";

describe("isAdmin (S-04 admin allowlist)", () => {
  it("allows an email present in the list (case-insensitive, trimmed)", () => {
    expect(isAdmin("Admin@Example.com", "admin@example.com, other@x.io")).toBe(true);
    expect(isAdmin("  admin@example.com ", "admin@example.com")).toBe(true);
  });

  it("denies an email not in the list", () => {
    expect(isAdmin("nobody@example.com", "admin@example.com")).toBe(false);
  });

  it("denies when the list is empty or unset", () => {
    expect(isAdmin("admin@example.com", "")).toBe(false);
    expect(isAdmin("admin@example.com", undefined)).toBe(false);
  });

  it("denies when the email is missing", () => {
    expect(isAdmin(null, "admin@example.com")).toBe(false);
    expect(isAdmin(undefined, "admin@example.com")).toBe(false);
  });
});
