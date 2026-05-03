import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getAccount } from "../../../../../lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const account = await getAccount();
    if (!account) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.ownerAccountId !== account.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (session.status !== "ACTIVE") return NextResponse.json({ error: "Session is not active" }, { status: 409 });

    // Unplayed = null scores AND no score submissions
    const unplayed = await prisma.match.findMany({
      where: {
        sessionId: session.id,
        pointsA: null,
        pointsB: null,
        scoreSubmissions: { none: {} },
      },
      select: { id: true },
    });

    const completedMatches = await prisma.match.count({
      where: { sessionId: session.id, status: "COMPLETE" },
    });

    await prisma.$transaction([
      prisma.match.updateMany({
        where: { id: { in: unplayed.map((m) => m.id) } },
        data: { status: "CANCELLED" },
      }),
      prisma.session.update({
        where: { id: session.id },
        data: { status: "COMPLETE", updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true, cancelledMatches: unplayed.length, completedMatches });
  } catch (err) {
    console.error("POST /api/sessions/[code]/end error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}