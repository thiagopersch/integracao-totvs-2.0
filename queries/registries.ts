// Shared, Redis-backed caches ("use cache: remote") of the small registries every form and filter
// loads (analysts, clients, requesters, setores, tipos, tags, TBCs). Not a "use server" module — see
// queries/tags.ts. Each is keyed by organization only (the per-user client scope is applied by the
// caller, outside the cache, so all users of an organization share one entry) and invalidated by the
// tag its registry's actions already update.

import { cacheLife, cacheTag } from "next/cache";
import { analystService } from "@/services/analyst.service";
import { clientService } from "@/services/client.service";
import { requesterService } from "@/services/requester.service";
import { departmentService } from "@/services/department.service";
import { demandTypeService } from "@/services/demand-type.service";
import { tagService } from "@/services/tag.service";
import { tbcService } from "@/services/tbc.service";

export async function getCachedAnalysts(organizationId: string) {
  "use cache: remote";
  cacheTag("analysts");
  cacheLife("registries");
  return analystService.listAll(organizationId);
}

export async function getCachedClients(organizationId: string) {
  "use cache: remote";
  cacheTag("clients");
  cacheLife("registries");
  return clientService.listAllUnrestricted(organizationId);
}

export async function getCachedRequesters(organizationId: string) {
  "use cache: remote";
  cacheTag("requesters");
  cacheLife("registries");
  return requesterService.listAll(organizationId);
}

export async function getCachedDepartments(organizationId: string) {
  "use cache: remote";
  cacheTag("departments");
  cacheLife("registries");
  return departmentService.listAll(organizationId);
}

export async function getCachedDemandTypes(organizationId: string) {
  "use cache: remote";
  cacheTag("demandTypes");
  cacheLife("registries");
  return demandTypeService.listAll(organizationId);
}

export async function getCachedTags(organizationId: string) {
  "use cache: remote";
  cacheTag("tags");
  cacheLife("registries");
  return tagService.listAll(organizationId);
}

/** TBCs are cached with the client scope in the key (passwords are stripped by tbcService.listAll). */
export async function getCachedTbcs(organizationId: string, allowedClientIds: string[]) {
  "use cache: remote";
  cacheTag("tbcs", "clients");
  cacheLife("registries");
  return tbcService.listAll(organizationId, allowedClientIds);
}
