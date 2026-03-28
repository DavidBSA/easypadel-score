import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { generateToken, SESSION_COOKIE } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const authToken = await prisma.authToken.findFirst({
      where: {
        token: otp,
        used: false,
        expiresAt: { gt: new Date() },
        account: { email },
      },
      include: { account: true },
      orderBy: { createdAt: "desc" },
    });

    if (!authToken) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { used: true },
    });

    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    await prisma.authToken.create({
      data: {
        email: authToken.email,
        token: sessionToken,
        expiresAt,
        used: false,
      },
    });

    const response = NextResponse.json({ success: true });
    response.headers.set(
      "Set-Cookie",
      `${SESSION_COOKIE}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=5184000`
    );

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
