import { notificationService } from "@/services/notification.service";
import { buildIntegrationTestFailedNotification } from "@/lib/notification-types";
import { classifyError } from "@/lib/error-kind";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/** Shared by every PS Docs server action (`actions/integrations/ps-docs.ts` and
 *  `actions/integrations/ps-portal-docs.ts`) — extracted here so both call the same
 *  auth/unwrap/logging plumbing instead of duplicating it. */

export function authHeaders(tokenPs: string) {
  return { Authorization: `Bearer ${tokenPs}`, "Content-Type": "application/json" };
}

export type Raw = Record<string, unknown>;

export function unwrapData(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const obj = payload as Raw;
  return "data" in obj ? obj.data : obj;
}

export function asArray(value: unknown): Raw[] {
  if (Array.isArray(value)) return value.filter((v): v is Raw => !!v && typeof v === "object");
  return [];
}

/** Best-effort: logging/notifying about a failure must never itself become the error the user
 *  sees — see the long-form comment previously on this function in `ps-docs.ts` for the FK-error
 *  incident that motivated the try/catch. */
export async function logAndNotifyFailure(params: { organizationId: string; userId: string; url: string; method: string; idPs: string; integration?: string; error: unknown }) {
  try {
    const errorMessage = (params.error as Error).message;
    await prisma.apiLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        integration: params.integration ?? "PS_DOCS",
        url: params.url,
        httpMethod: params.method,
        error: errorMessage,
        requestSummary: { idPs: params.idPs } as Prisma.InputJsonValue,
      },
    });
    const notification = buildIntegrationTestFailedNotification({ integration: params.integration ?? "PS_DOCS", errorMessage, errorKind: classifyError(params.error), url: params.url });
    await notificationService.create({ organizationId: params.organizationId, userId: params.userId, ...notification });
  } catch (logError) {
    console.error("[PS_DOCS] Falha ao registrar log/notificação de erro (não bloqueante):", logError);
  }
}

/** Same non-blocking guard as `logAndNotifyFailure`, for the success-path `apiLog` writes. */
export async function logApiCall(data: Prisma.ApiLogUncheckedCreateInput) {
  try {
    await prisma.apiLog.create({ data });
  } catch (logError) {
    console.error("[PS_DOCS] Falha ao registrar log de sucesso (não bloqueante):", logError);
  }
}
