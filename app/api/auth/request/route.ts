import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { generateToken } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    await prisma.account.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.authToken.create({
      data: { email, token, expiresAt, used: false },
    });

    const magicLink = `${process.env.APP_URL}/api/auth/verify?token=${token}`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EasyPadelScore <auth@easypadelscore.com>",
        to: [email],
        subject: "Your EasyPadelScore login link",
        html: `<h2>Sign in to EasyPadelScore</h2><p>Click the link below to sign in. This link expires in 15 minutes.</p><p><a href='${magicLink}' style='background:#FF6B00;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;'>Sign In</a></p><p style='color:#999;font-size:12px;'>If you did not request this, you can safely ignore this email.</p>`,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
