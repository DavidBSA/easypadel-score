import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { SESSION_COOKIE } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.authToken.updateMany({
      where: { token },
      data: { used: true },
    });
  }

  const response = NextResponse.json({ success: true });
  response.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );

  return response;
}
