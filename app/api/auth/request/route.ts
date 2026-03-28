import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.authToken.create({
      data: { email, token: otp, expiresAt, used: false },
    });

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EasyPadelScore <auth@easypadelscore.com>",
        to: [email],
        subject: "Your EasyPadelScore code",
        html: `<h2>Your sign-in code</h2><p>Enter this code to sign in to EasyPadelScore:</p><p style='font-size:48px;font-weight:bold;letter-spacing:8px;color:#FF6B00;'>${otp}</p><p style='color:#999;font-size:12px;'>This code expires in 15 minutes. If you didn't request this, ignore this email.</p>`,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
