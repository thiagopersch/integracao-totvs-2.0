import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  SOAP_DEFAULT_TIMEOUT: z.coerce.number().default(30000),
  SOAP_MAX_RETRIES: z.coerce.number().default(3),
  SOAP_RETRY_DELAY: z.coerce.number().default(1000),
  RM_SENTENCE_SERVICE_MODE: z.enum(["mock", "live"]).default("mock"),
  RM_GCONSSQL_DATASERVER_NAME: z.string().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten());
    throw new Error("Invalid environment variables");
  }
  return result.data;
}

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
