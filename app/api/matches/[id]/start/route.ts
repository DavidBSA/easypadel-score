import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { courtNumber, deviceId } = body;

    if (!courtNumber || !deviceId) {
      return NextResponse.json(
        { error: "courtNumber and deviceId required" },
        { status: 400 }
      );
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device?.isOrganiser) {
      return NextResponse.json(
        { error: "Organiser access required" },
        { status: 403 }
      );
    }

    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (match.status !== "PENDING") {
      return NextResponse.json(
        { error: "Match already started or complete" },
        { status: 409 }
      );
    }

    const [updated] = await prisma.$transaction([
      prisma.match.update({
        where: { id },
        data: { status: "IN_PROGRESS", courtNumber, startedAt: new Date() },
      }),
      prisma.session.update({
        where: { id: match.sessionId },
        data: {},
      }),
    ]);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/matches/[id]/start error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}