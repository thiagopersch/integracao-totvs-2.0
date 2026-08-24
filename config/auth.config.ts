export const AUTH_CONFIG = {
  SESSION_MAX_AGE: 60 * 60 * 24 * 7,
  RATE_LIMIT: {
    LOGIN: { window: 15 * 60 * 1000, max: 10 },
    API: { window: 60 * 1000, max: 100 },
  },
  BCRYPT_SALT_ROUNDS: 12,
} as const;
