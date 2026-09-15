"use server";

import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { notificationService } from "@/services/notification.service";
import { buildIntegrationTestFailedNotification } from "@/lib/notification-types";
import { classifyError } from "@/lib/error-kind";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Bateria de testes automáticos para a ficha de um processo seletivo (PS). Reaproveita o contrato
 * de API já reverse-engineered em `actions/integrations/ps-docs.ts` (`listSelectiveProcessStages`,
 * `fetchStageDocumentation`) — esta action só adiciona a checagem de alcançabilidade da página
 * pública da ficha e o utilitário de contagem de campos não resolvidos usado pelo relatório.
 */
const INTEGRATION = "PS_FICHA_TEST";

export interface FichaCheckResult {
  success: boolean;
  error?: string;
  url: string;
  httpStatus?: number;
  durationMs: number;
}

/** Teste 1 do relatório: confirma que a página pública da ficha (link informado pelo usuário)
 *  está no ar e respondendo, antes de qualquer chamada autenticada à API do PS. */
export async function testFichaPageReachability(input: { pageUrl: string }): Promise<FichaCheckResult> {
  const { organizationId, userId } = await requirePermission("ps_ficha_test", "execute");

  const url = input.pageUrl.trim();
  if (!url) return { success: false, error: "Informe o link da página", url, durationMs: 0 };

  const startTime = Date.now();
  try {
    const res = await axios.get(url, { validateStatus: () => true, timeout: 15_000 });
    const durationMs = Date.now() - startTime;
    const failed = res.status >= 400 || !res.data;

    await prisma.apiLog.create({
      data: {
        organizationId,
        userId,
        integration: INTEGRATION,
        url,
        httpMethod: "GET",
        httpStatus: res.status,
        duration: durationMs,
        error: failed ? `HTTP ${res.status}` : undefined,
        requestSummary: { url } as Prisma.InputJsonValue,
      },
    });

    if (failed) {
      const notification = buildIntegrationTestFailedNotification({
        integration: INTEGRATION,
        errorMessage: `HTTP ${res.status} ao acessar a página da ficha`,
        errorKind: res.status === 401 || res.status === 403 ? "auth" : "http",
        url,
      });
      await notificationService.create({ organizationId, userId, ...notification });
      return { success: false, error: `HTTP ${res.status}`, url, httpStatus: res.status, durationMs };
    }

    return { success: true, url, httpStatus: res.status, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    await prisma.apiLog.create({
      data: { organizationId, userId, integration: INTEGRATION, url, httpMethod: "GET", duration: durationMs, error: errorMessage, requestSummary: { url } as Prisma.InputJsonValue },
    });

    const notification = buildIntegrationTestFailedNotification({ integration: INTEGRATION, errorMessage, errorKind: classifyError(error), url });
    await notificationService.create({ organizationId, userId, ...notification });

    return { success: false, error: errorMessage, url, durationMs };
  }
}
