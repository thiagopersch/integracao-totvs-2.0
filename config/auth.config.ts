export const AUTH_CONFIG = {
  SESSION_MAX_AGE: 60 * 60 * 24 * 7,
  /** How often a session re-reads role/permissions/client access (and its revocation state) from the DB. */
  SESSION_REFRESH_INTERVAL_MS: 60 * 1000,
  RATE_LIMIT: {
    LOGIN: { window: 15 * 60 * 1000, max: 10 },
    /** Per target account, whatever the source IP — caps password guessing against one user. */
    LOGIN_PER_ACCOUNT: { window: 15 * 60 * 1000, max: 20 },
    CHANGE_PASSWORD: { window: 15 * 60 * 1000, max: 5 },
    API: { window: 60 * 1000, max: 100 },
  },
  BCRYPT_SALT_ROUNDS: 12,
} as const;
