import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeRoute } from "@/lib/api-auth";

export async function GET() {
  const { ctx, denied } = await authorizeRoute("soap", "execute");
  if (denied) return denied;
  const { organizationId, allowedClientIds } = ctx;
  const tbcs = await prisma.tbc.findMany({
    // Same client scoping as everywhere else — only TBCs of clients this user can access.
    where: { deletedAt: null, status: true, organizationId, clientId: { in: allowedClientIds } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      link: true,
      client: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(tbcs);
}
