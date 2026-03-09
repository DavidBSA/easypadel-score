import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { generateMatchQueue } from "../../../../../lib/queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
      include: { players: true, devices: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "LOBBY") {
      return NextResponse.json({ error: "Session is already started." }, { status: 409 });
    }

    const body = await req.json();
    const { deviceId } = body;

    const device = session.devices.find((d) => d.id === deviceId && d.isOrganiser);
    if (!device) {
      return NextResponse.json({ error: "Organiser access required." }, { status: 403 });
    }

    const minPlayers = session.courts * 4;
    if (session.players.length < minPlayers) {
      return NextResponse.json(
        { error: `Need at least ${minPlayers} players for ${session.courts} court${session.courts > 1 ? "s" : ""}.` },
        { status: 400 }
      );
    }

    const queueMatches = generateMatchQueue(
      session.players.map((p) => ({ id: p.id, name: p.name, isActive: true })),
      session.courts
    );

    await prisma.$transaction(async (tx) => {
      // Create the full match queue
      await tx.match.createMany({
        data: queueMatches.map((m) => ({
          sessionId: session.id,
          queuePosition: m.queuePosition,
          teamAPlayer1: m.teamAPlayer1,
          teamAPlayer2: m.teamAPlayer2,
          teamBPlayer1: m.teamBPlayer1,
          teamBPlayer2: m.teamBPlayer2,
        })),
      });

      // Activate session
      await tx.session.update({
        where: { id: session.id },
        data: { status: "ACTIVE" },
      });
    });

    // Auto-assign first N matches to courts 1..N
    // Fetch created matches in queue order
    const createdMatches = await prisma.match.findMany({
      where: { sessionId: session.id },
      orderBy: { queuePosition: "asc" },
    });

    const autoAssign = createdMatches.slice(0, session.courts);

    await prisma.$transaction([
      ...autoAssign.map((m, idx) =>
        prisma.match.update({
          where: { id: m.id },
          data: {
            status: "IN_PROGRESS",
            courtNumber: idx + 1,
            startedAt: new Date(),
          },
        })
      ),
      prisma.session.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/sessions/[code]/start error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}