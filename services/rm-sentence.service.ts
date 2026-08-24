import { prisma } from "@/lib/prisma";
import { env } from "@/config/app.config";
import { soapService } from "@/services/soap.service";
import type { Prisma, Filter, Tbc } from "@prisma/client";

export type RmSentenceRecord = {
  codeSentence: string;
  codColigada: string;
  codSystem: string;
  nameSentence: string;
  contentSentence: string;
  totvsUpdatedAt: Date | null;
  totvsUpdatedBy: string | null;
};

type FilterForFetch = Pick<
  Filter,
  | "filter"
  | "codColigadaSentenca"
  | "codSistemaSentenca"
  | "coligateContext"
  | "branchContext"
  | "levelEducationContext"
  | "codSystemContext"
  | "userContext"
>;

type TbcForRm = Pick<Tbc, "id" | "link" | "user" | "password">;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function extractLikePattern(filterExpr: string): string | null {
  const match = filterExpr.match(/LIKE\s+'([^']*)'/i);
  return match ? match[1] : null;
}

function likePatternToPrismaFilter(pattern: string): Prisma.StringFilter {
  const startsWithPct = pattern.startsWith("%");
  const endsWithPct = pattern.endsWith("%");
  const core = pattern.replace(/^%+/, "").replace(/%+$/, "");

  if (startsWithPct && endsWithPct) return { contains: core };
  if (endsWithPct) return { startsWith: core };
  if (startsWithPct) return { endsWith: core };
  return { equals: pattern };
}

async function fetchSentencesFromDb(filter: FilterForFetch, organizationId: string): Promise<RmSentenceRecord[]> {
  const likePattern = extractLikePattern(filter.filter);
  const where: Prisma.SentenceWhereInput = {
    organizationId,
    deletedAt: null,
    status: true,
    ...(likePattern ? { code: likePatternToPrismaFilter(likePattern) } : {}),
    ...(filter.codColigadaSentenca ? { codColigada: filter.codColigadaSentenca } : {}),
    ...(filter.codSistemaSentenca ? { codSystem: filter.codSistemaSentenca } : {}),
  };

  const sentences = await prisma.sentence.findMany({ where, orderBy: { code: "asc" } });

  return sentences.map((sentence) => ({
    codeSentence: sentence.code,
    codColigada: sentence.codColigada || filter.codColigadaSentenca,
    codSystem: sentence.codSystem || filter.codSistemaSentenca,
    nameSentence: sentence.name,
    contentSentence: sentence.content || "",
    totvsUpdatedAt: sentence.updatedAt,
    totvsUpdatedBy: null,
  }));
}

/** Backups sourced from a Filtro always read this app's own `sentences` table. */
export async function fetchSentencesForFilter(
  filter: FilterForFetch,
  organizationId: string
): Promise<RmSentenceRecord[]> {
  return fetchSentencesFromDb(filter, organizationId);
}

/**
 * Writes a sentence definition back to GCONSSQL via wsDataServer.SaveRecord.
 * RM_GCONSSQL_DATASERVER_NAME is the DataServerName exposing that table —
 * also customer/installation-specific and not guessable from public docs.
 */
export async function restoreSentenceToTbc(
  tbc: TbcForRm,
  sentence: Pick<RmSentenceRecord, "codeSentence" | "codColigada" | "codSystem" | "nameSentence" | "contentSentence">,
  organizationId: string
): Promise<void> {
  if (env.RM_SENTENCE_SERVICE_MODE === "mock") return;

  if (!env.RM_GCONSSQL_DATASERVER_NAME) {
    throw new Error(
      "RM_GCONSSQL_DATASERVER_NAME não configurado — defina o DataServerName do RM que representa a tabela " +
        "GCONSSQL (wsDataServer.SaveRecord) para habilitar a restauração em modo live."
    );
  }

  const root = env.RM_GCONSSQL_DATASERVER_NAME;
  const recordXml = `<${root}>
  <CODCOLIGADA>${escapeXml(sentence.codColigada)}</CODCOLIGADA>
  <APLICACAO>${escapeXml(sentence.codSystem)}</APLICACAO>
  <CODSENTENCA>${escapeXml(sentence.codeSentence)}</CODSENTENCA>
  <SENTENCA><![CDATA[${sentence.contentSentence}]]></SENTENCA>
</${root}>`;

  const methodXml = `<SaveRecord>
  <DataServerName>${escapeXml(root)}</DataServerName>
  <XML><![CDATA[${recordXml}]]></XML>
</SaveRecord>`;

  await soapService.execute(
    {
      dataserver: tbc.link,
      process: tbc.link,
      method: "SAVERECORD",
      xml: methodXml,
      context: { user: tbc.user },
    },
    organizationId
  );
}
