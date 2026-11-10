// Cached reads used by services and Server Components. Not a "use server" module (see queries/tags.ts).

import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { IntegrationKind } from "@/generated/prisma/client";

type Row = { timeoutMs: number; maxRetries: number; retryDelayMs: number };

/** Every override of the organization, keyed by integration (missing = defaults). */
export async function getIntegrationSettingsMap(organizationId: string): Promise<Partial<Record<IntegrationKind, Row>>> {
  "use cache";
  cacheTag("integration-settings", `integration-settings:${organizationId}`);
  cacheLife("hours");
  const rows = await prisma.integrationSettings.findMany({
    where: { organizationId },
    select: { integration: true, timeoutMs: true, maxRetries: true, retryDelayMs: true },
  });
  return Object.fromEntries(rows.map(({ integration, ...row }) => [integration, row]));
}
