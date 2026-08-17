import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set("access_token", "", { httpOnly: true, maxAge: 0, path: "/" });
  response.cookies.set("refresh_token", "", { httpOnly: true, maxAge: 0, path: "/" });
  return response;
}
