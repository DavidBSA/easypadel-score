import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { SessionStatus } from "../../../../app/generated/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: { orderBy: { createdAt: "asc" } },
        matches: {
          orderBy: { queuePosition: "asc" },
          include: { scoreSubmissions: true },
        },
        devices: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error("GET /api/sessions/[code] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { organiserPin } = body;

    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        matches: {
          include: { scoreSubmissions: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (organiserPin !== session.organiserPin) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 403 });
    }

    const hasScores = session.matches.some((m) => m.scoreSubmissions.length > 0);

    if (!hasScores) {
      await prisma.session.delete({ where: { id: session.id } });
    } else {
      await prisma.session.update({
        where: { id: session.id },
        data: { status: SessionStatus.CANCELLED, updatedAt: new Date() },
      });
    }

    return NextResponse.json({ deleted: true, hard: !hasScores });
  } catch (err) {
    console.error("DELETE /api/sessions/[code] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}