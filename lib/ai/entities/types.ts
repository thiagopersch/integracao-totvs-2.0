import type { z } from "zod";

/** Client-safe: shared by the assistant service (prompt/tool/parsing) and the preview cards. */

export const AI_ENTITY_KEYS = [
  "demand",
  "client",
  "analyst",
  "requester",
  "department",
  "demandType",
  "tag",
  "contract",
  "project",
  "projectTask",
  "customField",
] as const;
export type AiEntityKey = (typeof AI_ENTITY_KEYS)[number];

/** Lookup lists sent to the model (as `id | name`) and used by the reference comboboxes. */
export type AiCatalogKey =
  | "clients"
  | "analysts"
  | "requesters"
  | "departments"
  | "demandTypes"
  | "tags"
  | "contracts"
  | "projects"
  | "stages"
  | "users";

export interface AiCatalogItem {
  id: string;
  name: string;
  /** Owner of the item when the list is nested: contract → client, stage → project, project → client. */
  parentId?: string | null;
}

export type AiCatalogs = Partial<Record<AiCatalogKey, AiCatalogItem[]>>;

export type AiFieldKind = "text" | "textarea" | "date" | "time" | "number" | "enum" | "ref" | "bool" | "color";

export interface AiFieldDef {
  key: string;
  label: string;
  kind: AiFieldKind;
  required?: boolean;
  /** Extra guidance for the model (format, default, when to ask). */
  hint?: string;
  options?: readonly { value: string; label: string }[];
  /** kind "ref": the catalog the id comes from — or "@tempId" of a record of the batch that creates into it. */
  ref?: AiCatalogKey;
  /** kind "ref": field holding the owner the referenced item must belong to (contract → clientId). */
  parentField?: string;
  /** Takes the full card width. */
  wide?: boolean;
}

export interface AiEntityDef {
  key: AiEntityKey;
  label: string;
  /** RBAC resource checked with "create" (config/permissions.ts). */
  resource: string;
  /** Catalog a created record joins — what lets other proposals of the batch reference it via "@tempId". */
  catalog?: AiCatalogKey;
  /** Field shown as the card title and used in the "already created" note. */
  titleField: string;
  fields: AiFieldDef[];
  /** Values the model omitted. */
  defaults?: Record<string, string>;
  /** Entity-specific instructions appended to the system prompt. */
  rules?: string;
  schema: z.ZodType;
  /** Card values (all strings) → the input the entity's create action validates with `schema`. */
  toInput(values: Record<string, string>): Record<string, unknown>;
}

/** One record proposed by the AI. Values are strings ("" = empty); refs may be "@tempId". */
export interface AiRecordProposal {
  tempId: string;
  entity: AiEntityKey;
  values: Record<string, string>;
  /** Field → what still needs fixing before it can be created ("_form" = not tied to a field). */
  errors: Record<string, string>;
}

export const isRef = (value: string) => value.startsWith("@");
