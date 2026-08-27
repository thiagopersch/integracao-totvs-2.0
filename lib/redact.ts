const SENSITIVE_KEYS = [
  "password",
  "senha",
  "secret",
  "token",
  "apikey",
  "merchantkey",
  "securitycode",
  "cvv",
  "cardnumber",
  "authorization",
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
}

/** Shallow-redacts known-sensitive keys (password, tokens, card data, etc.) before a payload is
 *  persisted to a log/notification — never let secrets end up in AuditLog.newData, ApiLog
 *  requestSummary, or a notification's data JSON. */
export function redactObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key in result) {
    if (isSensitiveKey(key)) {
      result[key] = "***" as T[Extract<keyof T, string>];
    }
  }
  return result;
}
