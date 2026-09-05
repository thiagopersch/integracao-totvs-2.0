import { prisma } from "@/lib/prisma";
import type {
  CreateSoapEndpointTypeInput,
  UpdateSoapEndpointTypeInput,
  CreateSoapEndpointMethodInput,
  UpdateSoapEndpointMethodInput,
} from "@/schemas/soap-endpoint.schema";
import type { SoapEndpointType, SoapEndpointMethod } from "@/generated/prisma/client";
import type { ListParams, PaginationMeta } from "@/types/common";

export type SoapEndpointTypeWithMethods = SoapEndpointType & { methods: SoapEndpointMethod[] };

function buildWhere(
  params: ListParams,
  searchFields: string[],
  extraFilters?: Record<string, unknown>
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (extraFilters) {
    for (const [key, value] of Object.entries(extraFilters)) {
      if (value !== undefined && value !== "") {
        where[key] = value;
      }
    }
  }

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== "") {
        where[key] = value === "true" || value === true;
      }
    }
  }

  if (params.search) {
    where.OR = searchFields.map((field) => ({
      [field]: { contains: params.search, mode: "insensitive" },
    }));
  }

  return where;
}

function buildTypesWhere(params: ListParams): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const f = params.filters ?? {};

  if (f.type) where.type = f.type;
  if (f.suffix) where.suffix = f.suffix;
  if (f.active === "true" || f.active === true) where.active = true;
  else if (f.active === "false" || f.active === false) where.active = false;
  if (f.method) where.methods = { some: { method: { equals: f.method as string, mode: "insensitive" } } };

  if (params.search) {
    where.OR = ["label", "type", "suffix"].map((field) => ({
      [field]: { contains: params.search, mode: "insensitive" },
    }));
  }

  return where;
}

export const soapEndpointService = {
  async listTypes(params: ListParams) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = buildTypesWhere(params);
    const orderBy = params.sort
      ? { [params.sort.field]: params.sort.direction }
      : { type: "asc" as const };

    const [data, total] = await Promise.all([
      prisma.soapEndpointType.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { methods: true },
      }),
      prisma.soapEndpointType.count({ where }),
    ]);

    return {
      data: data as SoapEndpointTypeWithMethods[],
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      } as PaginationMeta,
    };
  },

  async listAllTypes() {
    return prisma.soapEndpointType.findMany({
      where: { active: true },
      orderBy: { type: "asc" },
      include: {
        methods: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      },
    }) as Promise<SoapEndpointTypeWithMethods[]>;
  },

  async getTypeById(id: string) {
    return prisma.soapEndpointType.findUnique({
      where: { id },
      include: {
        methods: { orderBy: { sortOrder: "asc" } },
      },
    }) as Promise<SoapEndpointTypeWithMethods | null>;
  },

  async createType(input: CreateSoapEndpointTypeInput) {
    const existing = await prisma.soapEndpointType.findUnique({
      where: { type: input.type },
    });
    if (existing) {
      throw new Error("Tipo de endpoint já cadastrado");
    }
    return prisma.soapEndpointType.create({ data: input }) as Promise<SoapEndpointType>;
  },

  async updateType(id: string, input: UpdateSoapEndpointTypeInput) {
    if (input.type) {
      const existing = await prisma.soapEndpointType.findFirst({
        where: { type: input.type, id: { not: id } },
      });
      if (existing) {
        throw new Error("Tipo de endpoint já cadastrado");
      }
    }
    return prisma.soapEndpointType.update({
      where: { id },
      data: input,
    }) as Promise<SoapEndpointType>;
  },

  async softDeleteType(id: string) {
    return prisma.soapEndpointType.update({
      where: { id },
      data: { active: false },
    }) as Promise<SoapEndpointType>;
  },

  async restoreType(id: string) {
    return prisma.soapEndpointType.update({
      where: { id },
      data: { active: true },
    }) as Promise<SoapEndpointType>;
  },

  async bulkSoftDeleteTypes(ids: string[]) {
    const result = await prisma.soapEndpointType.updateMany({
      where: { id: { in: ids } },
      data: { active: false },
    });
    return result.count;
  },

  async bulkRestoreTypes(ids: string[]) {
    const result = await prisma.soapEndpointType.updateMany({
      where: { id: { in: ids } },
      data: { active: true },
    });
    return result.count;
  },

  async listMethods(endpointTypeId: string, params: ListParams) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const where = buildWhere(params, ["method", "label"], {
      endpointTypeId,
    });
    const orderBy = params.sort
      ? { [params.sort.field]: params.sort.direction }
      : { sortOrder: "asc" as const };

    const [data, total] = await Promise.all([
      prisma.soapEndpointMethod.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.soapEndpointMethod.count({ where }),
    ]);

    return {
      data: data as SoapEndpointMethod[],
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      } as PaginationMeta,
    };
  },

  async getMethodById(id: string) {
    return prisma.soapEndpointMethod.findUnique({
      where: { id },
    }) as Promise<SoapEndpointMethod | null>;
  },

  async createMethod(input: CreateSoapEndpointMethodInput) {
    return prisma.soapEndpointMethod.create({ data: input }) as Promise<SoapEndpointMethod>;
  },

  async updateMethod(id: string, input: UpdateSoapEndpointMethodInput) {
    return prisma.soapEndpointMethod.update({
      where: { id },
      data: input,
    }) as Promise<SoapEndpointMethod>;
  },

  async softDeleteMethod(id: string) {
    return prisma.soapEndpointMethod.update({
      where: { id },
      data: { active: false },
    }) as Promise<SoapEndpointMethod>;
  },

  async restoreMethod(id: string) {
    return prisma.soapEndpointMethod.update({
      where: { id },
      data: { active: true },
    }) as Promise<SoapEndpointMethod>;
  },

  /**
   * Every place that actually talks to TOTVS (SOAP Builder, filter-driven backup/restore, …)
   * must resolve its ws folder + method from what's registered in /admin/soap-endpoints instead
   * of hardcoding them — this and the 3 lookups below are the single source of truth for that.
   */
  async getActiveTypeById(id: string): Promise<SoapEndpointType> {
    const record = await prisma.soapEndpointType.findFirst({ where: { id, active: true } });
    if (!record) {
      throw new Error("Tipo de endpoint não encontrado ou inativo em /admin/soap-endpoints.");
    }
    return record;
  },

  async getActiveTypeByKey(type: string): Promise<SoapEndpointType> {
    const record = await prisma.soapEndpointType.findFirst({ where: { type, active: true } });
    if (!record) {
      throw new Error(`Tipo de endpoint "${type}" não está cadastrado/ativo em /admin/soap-endpoints.`);
    }
    return record;
  },

  /** `suffix` is the real ws folder name (e.g. "wsDataServer") — SoapLog.process stores exactly
   *  that, so this is how a re-execution recovers which endpoint type produced a given log entry. */
  async getActiveTypeBySuffix(suffix: string): Promise<SoapEndpointType> {
    const record = await prisma.soapEndpointType.findFirst({ where: { suffix, active: true } });
    if (!record) {
      throw new Error(`Nenhum tipo de endpoint ativo em /admin/soap-endpoints usa o serviço "${suffix}".`);
    }
    return record;
  },

  async getActiveMethodById(id: string): Promise<SoapEndpointMethod> {
    const record = await prisma.soapEndpointMethod.findFirst({ where: { id, active: true } });
    if (!record) {
      throw new Error("Método não encontrado ou inativo em /admin/soap-endpoints.");
    }
    // `method` is a free-text field admins edit in the CRUD (e.g. "ReadView", "AutenticaAcesso") —
    // normalize to the SoapMethod enum's uppercase form so every consumer gets a canonical value
    // regardless of how it was typed there.
    return { ...record, method: record.method.toUpperCase() };
  },

  async getActiveMethodByKey(endpointTypeId: string, method: string): Promise<SoapEndpointMethod> {
    const record = await prisma.soapEndpointMethod.findFirst({
      where: { endpointTypeId, active: true, method: { equals: method, mode: "insensitive" } },
    });
    if (!record) {
      throw new Error(`Método "${method}" não está cadastrado/ativo em /admin/soap-endpoints para este tipo de endpoint.`);
    }
    return { ...record, method: record.method.toUpperCase() };
  },

  /** Distinct filter options for the /admin/soap-endpoints filter panel. Methods are deduplicated
   *  case-insensitively (admins may type "ReadView" in one type and "readview" in another) while
   *  still surfacing one representative label per unique value for display. */
  async listDistinctFilters() {
    const [types, suffixes, methods] = await Promise.all([
      prisma.soapEndpointType.findMany({ distinct: ["type"], select: { type: true }, orderBy: { type: "asc" } }),
      prisma.soapEndpointType.findMany({ distinct: ["suffix"], select: { suffix: true }, orderBy: { suffix: "asc" } }),
      prisma.soapEndpointMethod.findMany({ select: { method: true }, orderBy: { method: "asc" } }),
    ]);

    const methodByLowerCase = new Map<string, string>();
    for (const { method } of methods) {
      const key = method.toLowerCase();
      if (!methodByLowerCase.has(key)) methodByLowerCase.set(key, method);
    }

    return {
      types: types.map((t) => t.type),
      suffixes: suffixes.map((s) => s.suffix),
      methods: Array.from(methodByLowerCase.values()).sort((a, b) => a.localeCompare(b)),
    };
  },
};
