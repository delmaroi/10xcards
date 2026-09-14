// Framework-free credential reader for the email/password auth endpoints.
// `Request.formData()` THROWS on an unexpected Content-Type, so calling it bare in an
// endpoint turns any malformed POST into an unhandled 500 on a public route.

export interface Credentials {
  email: string;
  password: string;
}

/** Parse an auth form body. Returns null for a non-form body or missing fields. */
export async function readCredentials(request: Request): Promise<Credentials | null> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return null;
  }

  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string") return null;

  return { email, password };
}
