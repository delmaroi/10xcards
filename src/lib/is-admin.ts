// Pure admin-allowlist predicate (S-04). Admin identity for the MVP is an email
// allowlist (no role system — FR-003 full admin is Parked). Kept framework-free so
// it is unit-testable; the page passes the ADMIN_EMAILS env string in.

/**
 * Is `email` in the comma-separated `adminEmails` allowlist? Case-insensitive,
 * whitespace-tolerant. Empty/unset list or missing email → false (nobody is admin).
 */
export function isAdmin(email: string | null | undefined, adminEmails: string | undefined): boolean {
  if (!email || !adminEmails) return false;
  const allow = adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}
