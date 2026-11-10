import type { IntegrationKind } from "@/generated/prisma/client";

// Client-safe constants of the integration settings (no env access) — see lib/integration-config.ts.

export const INTEGRATION_KINDS = ["SOAP", "RUBEUS", "CIELO", "TPI", "GOOGLE_SHEETS", "SMTP", "BLOB"] as const satisfies readonly IntegrationKind[];

export const INTEGRATION_LABELS: Record<IntegrationKind, { label: string; description: string }> = {
  SOAP: { label: "TOTVS RM (SOAP/TBC)", description: "Execuções SOAP, autenticação e backups de sentenças" },
  RUBEUS: { label: "Rubeus (Processo Seletivo)", description: "Documentação, busca de elementos e testes da ficha" },
  CIELO: { label: "Cielo", description: "Transações de teste da API Cielo" },
  TPI: { label: "TPI TOTVS", description: "Login no portal do aluno" },
  GOOGLE_SHEETS: { label: "Google Sheets", description: "Sincronização de planilhas" },
  SMTP: { label: "E-mail (SMTP)", description: "Conexão, saudação e envio de e-mails" },
  BLOB: { label: "Armazenamento (Vercel Blob)", description: "Upload de imagens e anexos" },
};

/** Bounds enforced on save and when a caller passes its own timeout (e.g. the SOAP builder). */
export const INTEGRATION_LIMITS = {
  timeoutMs: { min: 1_000, max: 300_000 },
  maxRetries: { min: 0, max: 5 },
  retryDelayMs: { min: 0, max: 30_000 },
} as const;

/** Retries only make sense where the call is idempotent and the code loops on failure (SOAP today). */
export const RETRYABLE_INTEGRATIONS: readonly IntegrationKind[] = ["SOAP"];

