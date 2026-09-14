import { describe, it, expect } from "vitest";
import { readCredentials } from "@/lib/auth-form";

// Regression guard: `Request.formData()` throws on an unexpected Content-Type, and
// these endpoints are PUBLIC. An unguarded call turned any malformed POST into a
// 500. The contract here is "null, never throw".

const formRequest = (body: string) =>
  new Request("http://localhost/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

describe("readCredentials", () => {
  it("reads email and password from a urlencoded form", async () => {
    const result = await readCredentials(formRequest("email=a%40b.com&password=secret"));
    expect(result).toEqual({ email: "a@b.com", password: "secret" });
  });

  it("reads a multipart form body", async () => {
    const form = new FormData();
    form.set("email", "a@b.com");
    form.set("password", "secret");
    const result = await readCredentials(
      new Request("http://localhost/api/auth/signin", { method: "POST", body: form }),
    );
    expect(result).toEqual({ email: "a@b.com", password: "secret" });
  });

  it("returns null for a JSON body instead of throwing", async () => {
    const request = new Request("http://localhost/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "secret" }),
    });
    await expect(readCredentials(request)).resolves.toBeNull();
  });

  it("returns null when a field is missing", async () => {
    await expect(readCredentials(formRequest("email=a%40b.com"))).resolves.toBeNull();
    await expect(readCredentials(formRequest("password=secret"))).resolves.toBeNull();
  });

  it("returns null for an empty form", async () => {
    await expect(readCredentials(formRequest(""))).resolves.toBeNull();
  });

  it("passes empty strings through — the auth provider owns that rejection", async () => {
    // Deliberate: '' is a submitted-but-blank field, distinct from a missing one.
    await expect(readCredentials(formRequest("email=&password="))).resolves.toEqual({ email: "", password: "" });
  });
});
