import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tbcs = await prisma.tbc.findMany({
    where: { deletedAt: null, status: true },
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
