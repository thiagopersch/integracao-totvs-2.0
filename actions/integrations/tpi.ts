"use server";

import https from "node:https";
import axios from "axios";
import { requirePermission } from "@/lib/rbac";

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
  await requirePermission("integrations", "execute");

  const base = input.portalLink.trim().replace(/\/+$/, "");
  if (!base) return { success: false, error: "Informe o link do portal do aluno" };

  const url = `${base}${TPI_LOGIN_PATH}`;

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

    return { success: true, url, httpStatus: res.status, data: res.data };
  } catch (error) {
    return { success: false, url, error: (error as Error).message };
  }
}
