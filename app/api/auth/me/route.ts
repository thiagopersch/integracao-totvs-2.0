import { NextResponse } from "next/server";
import { authService } from "@/services/auth.service";
import { getRequestContext } from "@/lib/tenant";

export async function GET() {
  try {
    const { userId } = await getRequestContext();
    const user = await authService.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
