/**
 * Classifies a caught error into a coarse "what actually went wrong" bucket, shared by every
 * failure notification builder (SOAP dispatch, backup runs, API integration tests) so the
 * notification popover/dialog can show a consistent "Tipo de erro" badge instead of just a raw
 * message. Kept separate from soap.service.ts since API integration calls (Cielo/TPI) need the
 * same classification but never touch SoapFaultError.
 */
export type ErrorKind = "connection" | "timeout" | "auth" | "permission" | "http" | "fault" | "unknown";

export const ERROR_KIND_LABELS: Record<ErrorKind, string> = {
  connection: "Erro de conexão",
  timeout: "Tempo esgotado (timeout)",
  auth: "Falha de autenticação",
  permission: "Sem permissão no TOTVS",
  http: "Erro HTTP",
  fault: "Erro de negócio (SOAP Fault)",
  unknown: "Erro desconhecido",
};

export const ERROR_KIND_BADGE_VARIANT: Record<ErrorKind, "destructive" | "outline" | "secondary"> = {
  connection: "destructive",
  timeout: "destructive",
  auth: "destructive",
  permission: "destructive",
  http: "outline",
  fault: "secondary",
  unknown: "outline",
};

/** TOTVS RM's wording when the TBC user authenticates fine but its profile has no access to the
 *  requested Data Server/process — "Usuário sem permissão…", "Acesso negado", "não possui
 *  permissão de acesso…", or the generic .NET "access denied"/"not authorized". */
const PERMISSION_DENIED_PATTERN =
  /permiss[aã]o negada|sem permiss[aã]o|n[aã]o (tem|possui) (permiss[aã]o|acesso)|acesso negado|sem acesso|access (is )?denied|not authori[sz]ed|unauthori[sz]ed/i;

export function isPermissionDeniedMessage(message: string | null | undefined): boolean {
  return !!message && PERMISSION_DENIED_PATTERN.test(message);
}

const CONNECTION_ERROR_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"]);
const TIMEOUT_ERROR_CODES = new Set(["ECONNABORTED", "ETIMEDOUT"]);

/** Inspects an axios-shaped error (has `.code` and/or `.response.status`) — falls back to
 *  "unknown" for anything else (e.g. a plain thrown Error from application code). */
export function classifyError(error: unknown): ErrorKind {
  const err = error as { code?: string; response?: { status?: number }; message?: string } | null;
  if (!err) return "unknown";

  if (err.response?.status === 401) return "auth";
  if (err.response?.status === 403) return "permission";
  if (err.response?.status && err.response.status >= 400) return "http";
  if (err.code && CONNECTION_ERROR_CODES.has(err.code)) return "connection";
  if (err.code && TIMEOUT_ERROR_CODES.has(err.code)) return "timeout";
  if (typeof err.message === "string" && /timeout/i.test(err.message)) return "timeout";
  return "unknown";
}
