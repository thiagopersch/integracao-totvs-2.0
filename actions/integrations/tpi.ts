"use server";

import https from "node:https";
import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { notificationService } from "@/services/notification.service";
import { buildIntegrationTestFailedNotification } from "@/lib/notification-types";
import { classifyError } from "@/lib/error-kind";
import { prisma } from "@/lib/prisma";
import { redactObject } from "@/lib/redact";
import type { Prisma } from "@prisma/client";

/** Fixed relative to the customer's own "portal do aluno" link — only the base link is per-client. */
const TPI_LOGIN_PATH = "/RM/API/TOTVSProcessoSeletivo/Login";

export interface TpiLoginInput {
  portalLink: string;
  login: string;
  senha: string;
  tipoIdentificacao: string;
  codcoligada: string;
  codfilial: string;
  idps: string;
  useSsl: boolean;
}

export async function testTpiLogin(input: TpiLoginInput) {
  const { organizationId, userId } = await requirePermission("integrations", "execute");

  const base = input.portalLink.trim().replace(/\/+$/, "");
  if (!base) return { success: false, error: "Informe o link do portal do aluno" };

  const url = `${base}${TPI_LOGIN_PATH}`;
  // Never persist the password — only the non-sensitive identification fields.
  const requestSummary = {
    login: input.login,
    tipoIdentificacao: input.tipoIdentificacao,
    codcoligada: input.codcoligada,
    codfilial: input.codfilial,
    idps: input.idps,
  };
  const startTime = Date.now();

  try {
    const res = await axios.post(url, null, {
      params: {
        login: input.login,
        senha: input.senha,
        tipoIdentificacao: input.tipoIdentificacao,
        codcoligada: input.codcoligada,
        codfilial: input.codfilial,
        idps: input.idps,
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: input.useSsl }),
      headers: { "User-Agent": "integracao-totvs/1.0" },
      validateStatus: () => true,
      timeout: 30_000,
    });
    const duration = Date.now() - startTime;
    const failed = res.status >= 400;

    await prisma.apiLog.create({
      data: {
        organizationId,
        userId,
        integration: "TPI",
        url,
        httpMethod: "POST",
        httpStatus: res.status,
        duration,
        error: failed ? `HTTP ${res.status}` : undefined,
        requestSummary: requestSummary as Prisma.InputJsonValue,
        responseSummary: (typeof res.data === "object" && res.data !== null ? redactObject(res.data as Record<string, unknown>) : { raw: String(res.data).slice(0, 500) }) as Prisma.InputJsonValue,
      },
    });

    if (failed) {
      const notification = buildIntegrationTestFailedNotification({
        integration: "TPI",
        errorMessage: `HTTP ${res.status}`,
        errorKind: res.status === 401 ? "auth" : "http",
        url,
      });
      await notificationService.create({ organizationId, userId, ...notification });
    }

    return { success: true, url, httpStatus: res.status, data: res.data };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    await prisma.apiLog.create({
      data: { organizationId, userId, integration: "TPI", url, httpMethod: "POST", duration, error: errorMessage, requestSummary },
    });

    const notification = buildIntegrationTestFailedNotification({ integration: "TPI", errorMessage, errorKind: classifyError(error), url });
    await notificationService.create({ organizationId, userId, ...notification });

    return { success: false, url, error: errorMessage };
  }
}
