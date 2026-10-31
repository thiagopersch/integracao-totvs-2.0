import { prisma } from "@/lib/prisma";
import { descendantsOf } from "@/lib/tbc-checklist-links";
import type {
  TbcChecklistAddProcessosInput,
  TbcChecklistDataserverFieldsInput,
  TbcChecklistDataserverLinksInput,
  TbcChecklistField,
  TbcChecklistImportInput,
  TbcChecklistLink,
  TbcChecklistListingInput,
} from "@/schemas/tbc-checklist.schema";

/** A checklist as the checklist screen consumes it — `fields` narrowed from Prisma's `Json`. */
export type TbcChecklistView = {
  id: string;
  tbcId: string;
  name: string;
  coligateContext: number | null;
  branchContext: number | null;
  levelEducationContext: number | null;
  listingDataserverCode: string | null;
  listingIdFields: string[];
  listingLabelField: string | null;
  updatedAt: Date;
  dataservers: {
    id: string;
    dataserverCode: string;
    position: number;
    fields: TbcChecklistField[];
    links: TbcChecklistLink[];
  }[];
  processos: TbcChecklistProcessoView[];
};

/** A processo seletivo saved in the checklist — listed without going to TOTVS. */
export type TbcChecklistProcessoView = {
  id: string;
  codColigada: number;
  codFilial: number;
  levelEducation: number;
  idps: number;
  name: string;
};

const include = {
  dataservers: { orderBy: { position: "asc" as const } },
  processos: { orderBy: [{ codColigada: "desc" as const }, { idps: "desc" as const }] },
};

type ChecklistWithDataservers = NonNullable<Awaited<ReturnType<typeof findScoped>>>;

function toFields(value: unknown): TbcChecklistField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    item && typeof item === "object" && typeof item.table === "string" && typeof item.name === "string"
      ? [{ table: item.table, name: item.name }]
      : []
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object";

function toLinks(value: unknown): TbcChecklistLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((link) => {
    if (!isRecord(link) || typeof link.parentCode !== "string" || !Array.isArray(link.fields)) return [];
    const fields = link.fields.flatMap((f) =>
      isRecord(f) && typeof f.parent === "string" && typeof f.child === "string" ? [{ parent: f.parent, child: f.child }] : []
    );
    return fields.length ? [{ parentCode: link.parentCode, fields }] : [];
  });
}

function toView(checklist: ChecklistWithDataservers): TbcChecklistView {
  return {
    id: checklist.id,
    tbcId: checklist.tbcId,
    name: checklist.name,
    coligateContext: checklist.coligateContext,
    branchContext: checklist.branchContext,
    levelEducationContext: checklist.levelEducationContext,
    listingDataserverCode: checklist.listingDataserverCode,
    listingIdFields: checklist.listingIdFields,
    listingLabelField: checklist.listingLabelField,
    updatedAt: checklist.updatedAt,
    dataservers: checklist.dataservers.map((d) => ({
      id: d.id,
      dataserverCode: d.dataserverCode,
      position: d.position,
      fields: toFields(d.fields),
      links: toLinks(d.links),
    })),
    processos: checklist.processos.map((p) => ({
      id: p.id,
      codColigada: p.codColigada,
      codFilial: p.codFilial,
      levelEducation: p.levelEducation,
      idps: p.idps,
      name: p.name,
    })),
  };
}

/** Live TBC of the caller's organization and allowed clients — every checklist read/write goes
 *  through it, so a checklist is never reachable outside its TBC's tenant scope. */
function tbcScope(organizationId: string, allowedClientIds: string[]) {
  return { organizationId, deletedAt: null, clientId: { in: allowedClientIds } };
}

function findScoped(id: string, organizationId: string, allowedClientIds: string[]) {
  return prisma.tbcChecklist.findFirst({
    where: { id, organizationId, deletedAt: null, tbc: tbcScope(organizationId, allowedClientIds) },
    include,
  });
}

async function requireChecklist(id: string, organizationId: string, allowedClientIds: string[]) {
  const checklist = await findScoped(id, organizationId, allowedClientIds);
  if (!checklist) throw new Error("Checklist não encontrado ou fora do seu escopo de acesso");
  return checklist;
}

async function assertNameAvailable(tbcId: string, name: string, exceptId?: string) {
  const clash = await prisma.tbcChecklist.findFirst({
    where: { tbcId, deletedAt: null, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new Error(`Já existe um checklist chamado "${name}" para este TBC`);
}

/** Same table+field picked twice (any casing) is kept once, in first-seen order. */
function dedupeFields(fields: TbcChecklistField[]): TbcChecklistField[] {
  const seen = new Set<string>();
  return fields.filter((f) => {
    const key = `${f.table.toLowerCase()}.${f.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A checklist another one can import its structure from (any TBC in the caller's scope). */
export type TbcChecklistImportSource = {
  id: string;
  name: string;
  tbcName: string;
  clientName: string;
  dataserverCount: number;
  fieldCount: number;
};

export const tbcChecklistService = {
  async listByTbc(tbcId: string, organizationId: string, allowedClientIds: string[]): Promise<TbcChecklistView[]> {
    const checklists = await prisma.tbcChecklist.findMany({
      where: { tbcId, organizationId, deletedAt: null, tbc: tbcScope(organizationId, allowedClientIds) },
      orderBy: { updatedAt: "desc" },
      include,
    });
    return checklists.map(toView);
  },

  async getById(id: string, organizationId: string, allowedClientIds: string[]): Promise<TbcChecklistView | null> {
    const checklist = await findScoped(id, organizationId, allowedClientIds);
    return checklist ? toView(checklist) : null;
  },

  async create(tbcId: string, name: string, organizationId: string, allowedClientIds: string[]): Promise<TbcChecklistView> {
    const tbc = await prisma.tbc.findFirst({ where: { id: tbcId, ...tbcScope(organizationId, allowedClientIds) }, select: { id: true } });
    if (!tbc) throw new Error("TBC não encontrado ou fora do seu escopo de acesso");
    await assertNameAvailable(tbcId, name);
    const checklist = await prisma.tbcChecklist.create({ data: { organizationId, tbcId, name }, include });
    return toView(checklist);
  },

  async rename(id: string, name: string, organizationId: string, allowedClientIds: string[]): Promise<TbcChecklistView> {
    const checklist = await requireChecklist(id, organizationId, allowedClientIds);
    await assertNameAvailable(checklist.tbcId, name, id);
    return toView(await prisma.tbcChecklist.update({ where: { id }, data: { name }, include }));
  },

  /** Its Data Server entries belong to the checklist itself — they go with it, nothing blocks. */
  async softDelete(id: string, organizationId: string, allowedClientIds: string[]): Promise<TbcChecklistView> {
    const checklist = await requireChecklist(id, organizationId, allowedClientIds);
    await prisma.tbcChecklist.update({ where: { id }, data: { deletedAt: new Date() } });
    return toView(checklist);
  },

  async updateListing(id: string, input: TbcChecklistListingInput, organizationId: string, allowedClientIds: string[]) {
    await requireChecklist(id, organizationId, allowedClientIds);
    return toView(await prisma.tbcChecklist.update({ where: { id }, data: input, include }));
  },

  /** Adds the Data Server to the checklist (last position) or replaces its picked fields. */
  async upsertDataserver(id: string, input: TbcChecklistDataserverFieldsInput, organizationId: string, allowedClientIds: string[]) {
    const checklist = await requireChecklist(id, organizationId, allowedClientIds);
    const fields = dedupeFields(input.fields);
    const existing = checklist.dataservers.find((d) => d.dataserverCode === input.dataserverCode);
    if (existing) {
      await prisma.tbcChecklistDataserver.update({ where: { id: existing.id }, data: { fields } });
    } else {
      const position = checklist.dataservers.reduce((max, d) => Math.max(max, d.position + 1), 0);
      await prisma.tbcChecklistDataserver.create({ data: { checklistId: id, dataserverCode: input.dataserverCode, position, fields } });
    }
    // Touch the checklist so "most recently changed" ordering reflects field edits too.
    return toView(await prisma.tbcChecklist.update({ where: { id }, data: { updatedAt: new Date() }, include }));
  },

  /** Replaces the links of one of the checklist's Data Servers — every parent must be another
   *  Data Server of the checklist (once), and none may depend on this one already (no cycles). */
  async saveLinks(id: string, input: TbcChecklistDataserverLinksInput, organizationId: string, allowedClientIds: string[]) {
    const checklist = await requireChecklist(id, organizationId, allowedClientIds);
    const entry = checklist.dataservers.find((d) => d.dataserverCode === input.dataserverCode);
    if (!entry) throw new Error("Data Server não faz parte deste checklist");
    const parentCodes = input.links.map((l) => l.parentCode);
    if (new Set(parentCodes).size !== parentCodes.length) throw new Error("O mesmo Data Server foi vinculado mais de uma vez");
    if (parentCodes.includes(input.dataserverCode)) throw new Error("Um Data Server não pode ser vinculado a ele mesmo");
    const missing = parentCodes.filter((code) => !checklist.dataservers.some((d) => d.dataserverCode === code));
    if (missing.length) throw new Error(`Data Server vinculado fora deste checklist: ${missing.join(", ")}`);
    const dependents = descendantsOf(
      checklist.dataservers.map((d) => ({ dataserverCode: d.dataserverCode, links: toLinks(d.links) })),
      input.dataserverCode
    );
    const cyclic = parentCodes.filter((code) => dependents.has(code));
    if (cyclic.length) {
      throw new Error(`${cyclic.join(", ")} já depende deste Data Server — o vínculo fecharia um ciclo`);
    }
    await prisma.tbcChecklistDataserver.update({ where: { id: entry.id }, data: { links: input.links } });
    return toView(await prisma.tbcChecklist.update({ where: { id }, data: { updatedAt: new Date() }, include }));
  },

  /** Saves the picked processos seletivos — one already in the checklist (same coligada + IDPS)
   *  is skipped. */
  async addProcessos(id: string, input: TbcChecklistAddProcessosInput, organizationId: string, allowedClientIds: string[]) {
    await requireChecklist(id, organizationId, allowedClientIds);
    await prisma.tbcChecklistProcesso.createMany({
      data: input.processos.map((p) => ({ ...p, checklistId: id })),
      skipDuplicates: true,
    });
    return toView(await prisma.tbcChecklist.update({ where: { id }, data: { updatedAt: new Date() }, include }));
  },

  async removeProcesso(id: string, processoId: string, organizationId: string, allowedClientIds: string[]) {
    const checklist = await requireChecklist(id, organizationId, allowedClientIds);
    if (!checklist.processos.some((p) => p.id === processoId)) {
      throw new Error("Processo seletivo não faz parte deste checklist");
    }
    await prisma.tbcChecklistProcesso.delete({ where: { id: processoId } });
    return toView(await prisma.tbcChecklist.update({ where: { id }, data: { updatedAt: new Date() }, include }));
  },

  async listImportSources(targetId: string, organizationId: string, allowedClientIds: string[]): Promise<TbcChecklistImportSource[]> {
    const checklists = await prisma.tbcChecklist.findMany({
      where: { id: { not: targetId }, organizationId, deletedAt: null, tbc: tbcScope(organizationId, allowedClientIds) },
      orderBy: [{ tbc: { client: { name: "asc" } } }, { tbc: { name: "asc" } }, { name: "asc" }],
      // Only names of the TBC/client — never the TBC row itself (it holds the password).
      select: {
        id: true,
        name: true,
        tbc: { select: { name: true, client: { select: { name: true } } } },
        dataservers: { select: { fields: true } },
      },
    });
    return checklists.map((c) => ({
      id: c.id,
      name: c.name,
      tbcName: c.tbc.name,
      clientName: c.tbc.client.name,
      dataserverCount: c.dataservers.length,
      fieldCount: c.dataservers.reduce((sum, d) => sum + toFields(d.fields).length, 0),
    }));
  },

  /**
   * Copies the Data Servers/fields of `input.sourceId` into `targetId`: "replace" swaps the whole
   * structure for the source's (links included); "merge" adds missing Data Servers — with their
   * links to Data Servers the result has — and joins the fields of shared ones, which keep their own
   * links (only new Data Servers get links, so no cycle can form). The source's Contexto/listing setup is only copied when the target has none yet. Its
   * processos seletivos are never copied — they belong to the source TBC's base.
   */
  async importStructure(targetId: string, input: TbcChecklistImportInput, organizationId: string, allowedClientIds: string[]) {
    if (input.sourceId === targetId) throw new Error("Não é possível importar um checklist nele mesmo");
    const [target, source] = await Promise.all([
      requireChecklist(targetId, organizationId, allowedClientIds),
      requireChecklist(input.sourceId, organizationId, allowedClientIds),
    ]);
    if (!source.dataservers.length) throw new Error("O checklist de origem não tem Data Servers configurados");

    const copyContext = target.coligateContext === null && source.coligateContext !== null;
    const contextData = copyContext
      ? {
          coligateContext: source.coligateContext,
          branchContext: source.branchContext,
          levelEducationContext: source.levelEducationContext,
          listingDataserverCode: source.listingDataserverCode,
          listingIdFields: source.listingIdFields,
          listingLabelField: source.listingLabelField,
        }
      : {};

    const checklist = await prisma.$transaction(async (tx) => {
      if (input.mode === "replace") {
        await tx.tbcChecklistDataserver.deleteMany({ where: { checklistId: targetId } });
        await tx.tbcChecklistDataserver.createMany({
          data: source.dataservers.map((d, position) => ({
            checklistId: targetId,
            dataserverCode: d.dataserverCode,
            position,
            fields: dedupeFields(toFields(d.fields)),
            links: toLinks(d.links),
          })),
        });
      } else {
        const resultCodes = new Set([...target.dataservers, ...source.dataservers].map((d) => d.dataserverCode));
        let nextPosition = target.dataservers.reduce((max, d) => Math.max(max, d.position + 1), 0);
        for (const sourceDataserver of source.dataservers) {
          const sourceFields = toFields(sourceDataserver.fields);
          const existing = target.dataservers.find((d) => d.dataserverCode === sourceDataserver.dataserverCode);
          if (existing) {
            await tx.tbcChecklistDataserver.update({
              where: { id: existing.id },
              data: { fields: dedupeFields([...toFields(existing.fields), ...sourceFields]) },
            });
          } else {
            await tx.tbcChecklistDataserver.create({
              data: {
                checklistId: targetId,
                dataserverCode: sourceDataserver.dataserverCode,
                position: nextPosition++,
                fields: dedupeFields(sourceFields),
                links: toLinks(sourceDataserver.links).filter((l) => resultCodes.has(l.parentCode)),
              },
            });
          }
        }
      }
      return tx.tbcChecklist.update({ where: { id: targetId }, data: { ...contextData, updatedAt: new Date() }, include });
    });
    return toView(checklist);
  },

  async removeDataserver(id: string, dataserverCode: string, organizationId: string, allowedClientIds: string[]) {
    const checklist = await requireChecklist(id, organizationId, allowedClientIds);
    if (!checklist.dataservers.some((d) => d.dataserverCode === dataserverCode)) {
      throw new Error("Data Server não faz parte deste checklist");
    }
    const linked = checklist.dataservers.filter((d) => toLinks(d.links).some((l) => l.parentCode === dataserverCode));
    if (linked.length) {
      throw new Error(
        `Não é possível remover: ${linked.map((d) => d.dataserverCode).join(", ")} ${linked.length === 1 ? "está vinculado" : "estão vinculados"} a este Data Server. Remova o vínculo primeiro.`
      );
    }
    await prisma.tbcChecklistDataserver.delete({ where: { checklistId_dataserverCode: { checklistId: id, dataserverCode } } });
    return toView(await prisma.tbcChecklist.update({ where: { id }, data: { updatedAt: new Date() }, include }));
  },
};
