import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import type { Prisma } from "../../../app/generated/prisma";

function makeCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function makePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { format, courts, pointsPerMatch, servesPerRotation, maxPlayers } = body;

    if (!format || !["SINGLE", "MIXED", "TEAM"].includes(format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
    if (!courts || courts < 1 || courts > 6) {
      return NextResponse.json({ error: "Invalid courts" }, { status: 400 });
    }

    let code = makeCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.session.findUnique({ where: { code } });
      if (!existing) break;
      code = makeCode();
      attempts++;
    }

    const organiserPin = makePin();

    const session = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return tx.session.create({
        data: {
          code,
          organiserPin,
          format,
          courts,
          pointsPerMatch: pointsPerMatch ?? 21,
          servesPerRotation: servesPerRotation ?? 4,
          maxPlayers: maxPlayers ?? null,
        },
      });
    });

    return NextResponse.json({
      sessionId: session.id,
      code: session.code,
      organiserPin: session.organiserPin,
    });
  } catch (err) {
    console.error("POST /api/sessions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}