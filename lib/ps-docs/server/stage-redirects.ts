import { asArray, unwrapData, type Raw } from "@/lib/ps-docs/api-helpers";
import type { EncaminhamentoSpec } from "@/lib/ps-docs/types";
import type { RubeusClient } from "./rubeus-client";

/** Names the etapa an encaminhamento "Para outra etapa" (`redirect_type_id` 3) points at. The
 *  forward record only carries `stage_id`, so:
 *  - `GET /selective-process/button-redirect-stage/{stage_id}` -> `{portal_id, selective_process_id, stage_id}`
 *  - `GET /selective-process/opening-page-stages/{selective_process_id}` -> the etapa's `title`
 *  - only for an etapa of ANOTHER process: `GET /portal/selective-process-local/{portal_id}` (the
 *    process name) and `GET /portal` (the portal name).
 *  Repeated catalogs are fetched once thanks to the client's request memo. Best effort: on any
 *  failure the "Outra etapa (etapa #id)" fallback stays and a warning is added. */

// Not imported from ./process-structure, which imports this module.
const ADMIN_API = "https://admin.portal.apprbs.com.br/api";

type StageTarget = Pick<EncaminhamentoSpec, "etapaId" | "destino">;

/** Every encaminhamento with an `etapaId` anywhere under `roots` (etapas, pop-ups, páginas —
 *  nested pop-ups included), collected by a generic walk so no container kind is missed. */
export function collectStageRedirects(roots: unknown[]): StageTarget[] {
  const found: StageTarget[] = [];
  const seen = new Set<object>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) return node.forEach(visit);
    const obj = node as Raw;
    if (typeof obj.etapaId === "number" && typeof obj.destino === "string") found.push(obj as StageTarget);
    for (const value of Object.values(obj)) visit(value);
  };
  roots.forEach(visit);
  return found;
}

const nameById = (list: Raw[], id: number, keys: string[]): string | undefined => {
  const entry = list.find((e) => Number(e.id) === id);
  if (!entry) return undefined;
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

async function getList(client: RubeusClient, url: string): Promise<Raw[] | undefined> {
  const res = await client.get(url);
  return res.status < 400 ? asArray(unwrapData(res.data)) : undefined;
}

async function describeStage(client: RubeusClient, stageId: number, idPs: string | undefined): Promise<string | undefined> {
  const res = await client.get(`${ADMIN_API}/selective-process/button-redirect-stage/${stageId}`);
  if (res.status >= 400) return undefined;
  const ref = unwrapData(res.data) as Raw | undefined;
  const psId = Number(ref?.selective_process_id);
  const portalId = Number(ref?.portal_id);
  if (!psId) return undefined;

  const stages = await getList(client, `${ADMIN_API}/selective-process/opening-page-stages/${psId}`);
  const etapa = stages && nameById(stages, Number(ref?.stage_id) || stageId, ["title", "name"]);
  if (!etapa) return undefined;
  if (idPs && String(psId) === String(idPs).trim()) return `Etapa: ${etapa}`;

  const [processes, portals] = await Promise.all([
    portalId ? getList(client, `${ADMIN_API}/portal/selective-process-local/${portalId}`) : undefined,
    portalId ? getList(client, `${ADMIN_API}/portal`) : undefined,
  ]);
  const processo = (processes && nameById(processes, psId, ["name", "title"])) ?? `#${psId}`;
  const portal = (portals && nameById(portals, portalId, ["name", "title", "nome"])) ?? (portalId ? `#${portalId}` : undefined);
  return `Etapa: ${etapa} (processo seletivo ${processo}${portal ? `, portal ${portal}` : ""})`;
}

export async function resolveStageRedirects(client: RubeusClient, roots: unknown[], ctx: { idPs?: string }, warnings: string[]): Promise<void> {
  const targets = collectStageRedirects(roots);
  const ids = [...new Set(targets.map((t) => t.etapaId!))];
  if (ids.length === 0) return;
  const names = new Map(
    await Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await describeStage(client, id, ctx.idPs)] as const;
        } catch (error) {
          if ((error as Error).name === "AbortError") throw error;
          return [id, undefined] as const;
        }
      })
    )
  );
  for (const id of ids) if (!names.get(id)) warnings.push(`Encaminhamento para a etapa #${id}: não foi possível identificar o nome da etapa.`);
  for (const t of targets) {
    const name = names.get(t.etapaId!);
    if (name) t.destino = name;
  }
}
