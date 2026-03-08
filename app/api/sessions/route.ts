import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import type { Prisma } from "../../../app/generated/prisma";
import { generateMatchQueue } from "../../../lib/queue";

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
    const { format, courts, pointsPerMatch, players } = body;

    // Validate
    if (!format || !["MIXED", "TEAM"].includes(format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
    if (!courts || courts < 1 || courts > 6) {
      return NextResponse.json({ error: "Invalid courts" }, { status: 400 });
    }
    if (!players || players.length < courts * (format === "TEAM" ? 2 : 4)) {
      return NextResponse.json(
        { error: "Not enough players" },
        { status: 400 }
      );
    }

    // Generate unique code
    let code = makeCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.session.findUnique({ where: { code } });
      if (!existing) break;
      code = makeCode();
      attempts++;
    }

    const organiserPin = makePin();

    // Create session + players in a transaction
    const session = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const sess = await tx.session.create({
        data: {
          code,
          organiserPin,
          format,
          courts,
          pointsPerMatch: pointsPerMatch ?? 21,
        },
      });

      // Create players
      const createdPlayers = await Promise.all(
        players.map((p: { name: string; partnerName?: string }) =>
          tx.player.create({
            data: {
              sessionId: sess.id,
              name: p.name,
              partnerName: p.partnerName ?? null,
            },
          })
        )
      );

      // Generate match queue
      const queueMatches = generateMatchQueue(
        createdPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          isActive: true,
        })),
        courts
      );

      // Create all matches
      await tx.match.createMany({
        data: queueMatches.map((m) => ({
          sessionId: sess.id,
          queuePosition: m.queuePosition,
          teamAPlayer1: m.teamAPlayer1,
          teamAPlayer2: m.teamAPlayer2,
          teamBPlayer1: m.teamBPlayer1,
          teamBPlayer2: m.teamBPlayer2,
        })),
      });

      return sess;
    });

    return NextResponse.json({
      sessionId: session.id,
      code: session.code,
      organiserPin: session.organiserPin,
    });
  } catch (err) {
    console.error("POST /api/sessions error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}