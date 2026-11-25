"use server";

import { getIntegrationConfig } from "@/lib/integration-config";
import https from "node:https";
import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { notificationService } from "@/services/notification.service";
import { buildIntegrationTestFailedNotification } from "@/lib/notification-types";
import { classifyError } from "@/lib/error-kind";
import { prisma } from "@/lib/prisma";
import { redactObject } from "@/lib/redact";
import type { Prisma } from "@/generated/prisma/client";

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
      timeout: (await getIntegrationConfig(organizationId, "TPI")).timeoutMs,
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

const TPI_PIX_PATH = "/RM/API/TOTVSProcessoSeletivo/Financeiro/v1/DadosPagamentoPix";

export interface TpiPixInput extends TpiLoginInput {
  idBoleto: string;
  valor: string;
}

export interface TpiPixBoletoLan {
  CodColigada?: number;
  IdBoleto?: number;
  IdLan?: number | null;
  ValorPago?: number;
}

export interface TpiPixData {
  CodColigada?: number;
  CodFilial?: number;
  BoletosLan?: TpiPixBoletoLan[];
  Valor?: number;
  IdCarteira?: string | null;
  IdTrasancao?: number | null;
  QrCode?: string | null;
  QrCodeTexto?: string | null;
  Link?: string | null;
  DataExpiracao?: string | null;
  DataOperacao?: string | null;
  DataPagamento?: string | null;
  Status?: string | number | null;
  NSU?: string | null;
  IdProcesso?: string | number | null;
  CodReturno?: number | null;
  Mensagem?: string | null;
  ValidaCNABPix?: boolean | null;
  CanalPagamento?: number | null;
  StatusTransacao?: string | number | null;
  InternalId?: string | null;
  [key: string]: unknown;
}

interface TpiStepResult<T = unknown> {
  url: string;
  httpStatus?: number;
  data?: T;
  error?: string;
}

export interface TpiPixResult {
  success: boolean;
  step: "login" | "pix";
  error?: string;
  login: TpiStepResult<{ data?: { CODUSUARIOPS?: string; NOME?: string; TOKEN?: string; LOGADOSUCESSO?: boolean }; messages?: unknown[] }>;
  pix?: TpiStepResult<TpiPixData>;
}

function parseMaybeJson(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function toLogSummary(data: unknown): Prisma.InputJsonValue {
  if (typeof data === "object" && data !== null) return redactObject(data as Record<string, unknown>) as Prisma.InputJsonValue;
  return { raw: String(data).slice(0, 500) };
}

/** Logs in (same request as testTpiLogin) and, with the returned TOKEN as the auth cookie, fetches the PIX payment data of a boleto. */
export async function testTpiPix(input: TpiPixInput): Promise<TpiPixResult> {
  const { organizationId, userId } = await requirePermission("integrations", "execute");

  const base = input.portalLink.trim().replace(/\/+$/, "");
  const loginUrl = `${base}${TPI_LOGIN_PATH}`;
  const pixUrl = `${base}${TPI_PIX_PATH}`;
  if (!base) return { success: false, step: "login", error: "Informe o link do portal do aluno", login: { url: loginUrl } };
  if (!input.idBoleto.trim() || !input.valor.trim()) {
    return { success: false, step: "pix", error: "Informe o ID do boleto e o valor", login: { url: loginUrl } };
  }

  const httpsAgent = new https.Agent({ rejectUnauthorized: input.useSsl });
  const timeout = (await getIntegrationConfig(organizationId, "TPI")).timeoutMs;

  // ── 1. Login ──────────────────────────────────────────────────────────────
  let loginResult: TpiPixResult["login"];
  let cookies: string[] = [];
  const loginStart = Date.now();
  try {
    const res = await axios.post(loginUrl, null, {
      params: {
        login: input.login,
        senha: input.senha,
        tipoIdentificacao: input.tipoIdentificacao,
        codcoligada: input.codcoligada,
        codfilial: input.codfilial,
        idps: input.idps,
      },
      httpsAgent,
      headers: { "User-Agent": "integracao-totvs/1.0" },
      validateStatus: () => true,
      timeout,
    });
    const data = parseMaybeJson(res.data) as TpiPixResult["login"]["data"];
    const failed = res.status >= 400;
    const inner = data && typeof data === "object" && data.data && typeof data.data === "object" ? data.data : undefined;

    await prisma.apiLog.create({
      data: {
        organizationId,
        userId,
        integration: "TPI",
        url: loginUrl,
        httpMethod: "POST",
        httpStatus: res.status,
        duration: Date.now() - loginStart,
        error: failed ? `HTTP ${res.status}` : undefined,
        requestSummary: {
          login: input.login,
          tipoIdentificacao: input.tipoIdentificacao,
          codcoligada: input.codcoligada,
          codfilial: input.codfilial,
          idps: input.idps,
        },
        // TOKEN is nested under data — redact it explicitly (redactObject is shallow).
        responseSummary: inner ? toLogSummary({ ...data, data: redactObject(inner as Record<string, unknown>) }) : toLogSummary(data),
      },
    });

    loginResult = { url: loginUrl, httpStatus: res.status, data };
    cookies = (res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0].trim()).filter(Boolean);

    if (failed || inner?.LOGADOSUCESSO !== true || !inner?.TOKEN) {
      const errorMessage = failed ? `HTTP ${res.status}` : "Login não teve sucesso";
      if (failed) {
        const notification = buildIntegrationTestFailedNotification({
          integration: "TPI",
          errorMessage,
          errorKind: res.status === 401 ? "auth" : "http",
          url: loginUrl,
        });
        await notificationService.create({ organizationId, userId, ...notification });
      }
      return { success: false, step: "login", error: errorMessage, login: loginResult };
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    await prisma.apiLog.create({
      data: { organizationId, userId, integration: "TPI", url: loginUrl, httpMethod: "POST", duration: Date.now() - loginStart, error: errorMessage },
    });
    const notification = buildIntegrationTestFailedNotification({ integration: "TPI", errorMessage, errorKind: classifyError(error), url: loginUrl });
    await notificationService.create({ organizationId, userId, ...notification });
    return { success: false, step: "login", error: errorMessage, login: { url: loginUrl, error: errorMessage } };
  }

  // ── 2. PIX ────────────────────────────────────────────────────────────────
  const token = loginResult.data!.data!.TOKEN!;
  const cookieParts = [".ASPXAUTH=", `EduPSAutenticacaoToken=${token}`];
  for (const c of cookies) {
    const name = c.split("=")[0];
    if (name !== ".ASPXAUTH" && name !== "EduPSAutenticacaoToken") cookieParts.push(c);
  }
  const valor = input.valor.trim().replace(",", ".");
  const pixParams = { codcoligada: input.codcoligada, codfilial: input.codfilial, idBoleto: input.idBoleto.trim(), valor };
  const pixStart = Date.now();

  try {
    const res = await axios.post(pixUrl, null, {
      params: pixParams,
      httpsAgent,
      headers: { "User-Agent": "integracao-totvs/1.0", Cookie: cookieParts.join("; ") },
      validateStatus: () => true,
      timeout,
    });
    const data = parseMaybeJson(res.data) as TpiPixData;
    const failed = res.status >= 400;
    // Keep the log small: drop the base64 QR image.
    const logData = data && typeof data === "object" && typeof data.QrCode === "string" ? { ...data, QrCode: "[base64 omitido]" } : data;

    await prisma.apiLog.create({
      data: {
        organizationId,
        userId,
        integration: "TPI",
        url: pixUrl,
        httpMethod: "POST",
        httpStatus: res.status,
        duration: Date.now() - pixStart,
        error: failed ? `HTTP ${res.status}` : undefined,
        requestSummary: pixParams,
        responseSummary: toLogSummary(logData),
      },
    });

    if (failed) {
      const notification = buildIntegrationTestFailedNotification({
        integration: "TPI",
        errorMessage: `HTTP ${res.status}`,
        errorKind: res.status === 401 ? "auth" : "http",
        url: pixUrl,
      });
      await notificationService.create({ organizationId, userId, ...notification });
      return { success: false, step: "pix", error: `HTTP ${res.status}`, login: loginResult, pix: { url: pixUrl, httpStatus: res.status, data } };
    }

    return { success: true, step: "pix", login: loginResult, pix: { url: pixUrl, httpStatus: res.status, data } };
  } catch (error) {
    const errorMessage = (error as Error).message;
    await prisma.apiLog.create({
      data: { organizationId, userId, integration: "TPI", url: pixUrl, httpMethod: "POST", duration: Date.now() - pixStart, error: errorMessage, requestSummary: pixParams },
    });
    const notification = buildIntegrationTestFailedNotification({ integration: "TPI", errorMessage, errorKind: classifyError(error), url: pixUrl });
    await notificationService.create({ organizationId, userId, ...notification });
    return { success: false, step: "pix", error: errorMessage, login: loginResult, pix: { url: pixUrl, error: errorMessage } };
  }
}
