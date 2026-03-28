import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { generateToken, SESSION_COOKIE } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const authToken = await prisma.authToken.findUnique({
    where: { token },
    include: { account: true },
  });

  if (!authToken) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url));
  }

  if (authToken.used) {
    return NextResponse.redirect(new URL("/login?error=used", req.url));
  }

  if (authToken.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/login?error=expired", req.url));
  }

  await prisma.authToken.update({
    where: { token },
    data: { used: true },
  });

  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.authToken.create({
    data: {
      email: authToken.email,
      token: sessionToken,
      expiresAt,
      used: false,
    },
  });

  const response = NextResponse.redirect(new URL("/account", req.url));
  response.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );

  return response;
}
