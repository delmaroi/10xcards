export const API_ERROR_CODES = {
  UNAUTHORIZED: "errors.unauthorized",
  SUPABASE_NOT_CONFIGURED: "errors.supabaseNotConfigured",
  INVALID_JSON: "errors.invalidJson",
  VALIDATION_FAILED: "errors.validationFailed",
  NETWORK_ERROR: "errors.networkError",
  FORBIDDEN: "errors.forbidden",
  NOT_FOUND: "errors.notFound",
  SERVER_ERROR: "errors.serverError",
  RATE_LIMIT_EXCEEDED: "errors.rateLimitExceeded",
  CURRENT_PASSWORD_INCORRECT: "errors.currentPasswordIncorrect",
  SERVICE_UNAVAILABLE: "errors.serviceUnavailable",
  INVALID_CREDENTIALS: "errors.invalidCredentials",
  EMAIL_ALREADY_REGISTERED: "errors.emailAlreadyRegistered",
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;

export function getErrorI18nKey(code: string): string {
  if (code in API_ERROR_CODES) {
    return API_ERROR_CODES[code as ApiErrorCode];
  }
  return "errors.serverError";
}
