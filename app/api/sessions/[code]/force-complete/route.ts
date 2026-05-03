import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getAccount } from "../../../../../lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const account = await getAccount();
    if (!account) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { matchId, scoreA, scoreB } = body;

    if (!matchId || scoreA === undefined || scoreB === undefined) {
      return NextResponse.json({ error: "matchId, scoreA, scoreB required" }, { status: 400 });
    }
    if (typeof scoreA !== "number" || typeof scoreB !== "number" || scoreA < 0 || scoreB < 0) {
      return NextResponse.json({ error: "scoreA and scoreB must be non-negative numbers" }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.ownerAccountId !== account.id) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.sessionId !== session.id) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (match.status === "COMPLETE") {
      return NextResponse.json({ error: "Match is already complete" }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.match.update({
        where: { id: matchId },
        data: {
          pointsA: scoreA,
          pointsB: scoreB,
          scoreStatus: "CONFIRMED",
          status: "COMPLETE",
          completedAt: new Date(),
        },
      }),
      prisma.session.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    await autoAssignNextMatches(session.id, session.courts);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/sessions/[code]/force-complete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function autoAssignNextMatches(sessionId: string, courts: number) {
  const activeMatches = await prisma.match.findMany({
    where: { sessionId, status: "IN_PROGRESS" },
  });

  const busyPlayerIds = new Set<string>();
  const busyCourts = new Set<number>();
  for (const m of activeMatches) {
    busyPlayerIds.add(m.teamAPlayer1);
    busyPlayerIds.add(m.teamAPlayer2);
    busyPlayerIds.add(m.teamBPlayer1);
    busyPlayerIds.add(m.teamBPlayer2);
    if (m.courtNumber) busyCourts.add(m.courtNumber);
  }

  const freeCourts: number[] = [];
  for (let i = 1; i <= courts; i++) {
    if (!busyCourts.has(i)) freeCourts.push(i);
  }
  if (freeCourts.length === 0) return;

  const pendingMatches = await prisma.match.findMany({
    where: { sessionId, status: "PENDING" },
    orderBy: { queuePosition: "asc" },
  });

  const toAssign: { id: string; courtNumber: number }[] = [];
  for (const court of freeCourts) {
    const eligible = pendingMatches.find(
      (m) =>
        !toAssign.some((a) => a.id === m.id) &&
        !busyPlayerIds.has(m.teamAPlayer1) &&
        !busyPlayerIds.has(m.teamAPlayer2) &&
        !busyPlayerIds.has(m.teamBPlayer1) &&
        !busyPlayerIds.has(m.teamBPlayer2)
    );
    if (!eligible) continue;
    toAssign.push({ id: eligible.id, courtNumber: court });
    busyPlayerIds.add(eligible.teamAPlayer1);
    busyPlayerIds.add(eligible.teamAPlayer2);
    busyPlayerIds.add(eligible.teamBPlayer1);
    busyPlayerIds.add(eligible.teamBPlayer2);
  }
  if (toAssign.length === 0) return;

  await prisma.$transaction([
    ...toAssign.map(({ id, courtNumber }) =>
      prisma.match.update({
        where: { id },
        data: { status: "IN_PROGRESS", courtNumber, startedAt: new Date() },
      })
    ),
    prisma.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } }),
  ]);
}
