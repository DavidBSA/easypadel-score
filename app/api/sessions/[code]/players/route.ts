import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

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
      return NextResponse.json({ error: "Session has already started." }, { status: 409 });
    }

    const body = await req.json();
    const { deviceId, playerName } = body;

    const device = session.devices.find((d) => d.id === deviceId && d.isOrganiser);
    if (!device) {
      return NextResponse.json({ error: "Organiser access required." }, { status: 403 });
    }

    const name = (playerName ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Player name is required." }, { status: 400 });
    }

    const duplicate = session.players.some(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { error: "DUPLICATE_NAME", message: `"${name}" is already in this session.` },
        { status: 409 }
      );
    }

    if (session.maxPlayers !== null && session.players.length >= session.maxPlayers) {
      return NextResponse.json(
        { error: "SESSION_FULL", message: "Player cap reached." },
        { status: 409 }
      );
    }

    const player = await prisma.player.create({
      data: { sessionId: session.id, name },
    });

    return NextResponse.json({ playerId: player.id, name: player.name });
  } catch (err) {
    console.error("POST /api/sessions/[code]/players error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}