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
      include: { players: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await req.json();
    const { organiserPin, playerName, playerId, courtNumber } = body;

    // ── Path 1: Organiser ──────────────────────────────────────────────────────
    if (organiserPin && organiserPin === session.organiserPin) {
      const device = await prisma.device.create({
        data: { sessionId: session.id, isOrganiser: true, courtNumber: courtNumber ?? null },
      });
      return NextResponse.json({
        deviceId: device.id,
        isOrganiser: true,
        sessionId: session.id,
        code: session.code,
      });
    }

    // ── Path 2: Claim existing (manually-added) player ─────────────────────────
    if (playerId) {
      const existing = session.players.find((p) => p.id === playerId);
      if (!existing) {
        return NextResponse.json(
          { error: "Player not found in this session." },
          { status: 404 }
        );
      }

      const device = await prisma.device.create({
        data: {
          sessionId: session.id,
          isOrganiser: false,
          playerId: existing.id,
          courtNumber: courtNumber ?? null,
        },
      });

      return NextResponse.json({
        deviceId: device.id,
        isOrganiser: false,
        playerId: existing.id,
        playerName: existing.name,
        sessionId: session.id,
        code: session.code,
      });
    }

    // ── Path 3: Self-registration (new player via join code) ───────────────────
    if (session.status !== "LOBBY") {
      return NextResponse.json(
        { error: "SESSION_LOCKED", message: "This session has already started. Ask your organiser to add you manually." },
        { status: 409 }
      );
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
        { error: "DUPLICATE_NAME", message: `"${name}" has already joined this session. Please use a different name.` },
        { status: 409 }
      );
    }

    if (session.maxPlayers !== null && session.players.length >= session.maxPlayers) {
      return NextResponse.json(
        { error: "SESSION_FULL", message: "All player slots are full — ask your organiser about the next event." },
        { status: 409 }
      );
    }

    const { device, player } = await prisma.$transaction(async (tx) => {
      const player = await tx.player.create({
        data: { sessionId: session.id, name },
      });
      const device = await tx.device.create({
        data: { sessionId: session.id, isOrganiser: false, playerId: player.id, courtNumber: courtNumber ?? null },
      });
      return { device, player };
    });

    return NextResponse.json({
      deviceId: device.id,
      isOrganiser: false,
      playerId: player.id,
      playerName: player.name,
      sessionId: session.id,
      code: session.code,
    });

  } catch (err) {
    console.error("POST /api/sessions/[code]/devices error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}