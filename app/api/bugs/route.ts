import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageUrl, sessionCode, userNote } = body;

    if (!pageUrl) {
      return NextResponse.json({ error: "pageUrl is required" }, { status: 400 });
    }

    const report = await prisma.bugReport.create({
      data: {
        pageUrl,
        sessionCode: sessionCode ?? null,
        userNote: userNote ?? null,
        status: "OPEN",
      },
    });

    const emailHtml = `<h2>New Bug Report</h2><p><b>Page:</b> ${pageUrl}</p><p><b>Session:</b> ${sessionCode ?? "N/A"}</p><p><b>Note:</b> ${userNote ?? "None"}</p><p><b>Time:</b> ${new Date().toISOString()}</p>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EasyPadelScore <bugs@easypadelscore.com>",
        to: ["davidbellsa@gmail.com"],
        subject: "🐛 New Bug Report — EasyPadelScore",
        html: emailHtml,
      }),
    });

    return NextResponse.json({ id: report.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
