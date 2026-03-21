import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

async function autoAssignNextMatch(sessionId: string, freedCourt: number) {
  const activeMatches = await prisma.match.findMany({
    where: { sessionId, status: "IN_PROGRESS" },
  });

  const busyPlayerIds = new Set<string>();
  for (const m of activeMatches) {
    busyPlayerIds.add(m.teamAPlayer1);
    busyPlayerIds.add(m.teamAPlayer2);
    busyPlayerIds.add(m.teamBPlayer1);
    busyPlayerIds.add(m.teamBPlayer2);
  }

  const pendingMatches = await prisma.match.findMany({
    where: { sessionId, status: "PENDING" },
    orderBy: { queuePosition: "asc" },
  });

  const eligible = pendingMatches.find(
    (m) =>
      !busyPlayerIds.has(m.teamAPlayer1) &&
      !busyPlayerIds.has(m.teamAPlayer2) &&
      !busyPlayerIds.has(m.teamBPlayer1) &&
      !busyPlayerIds.has(m.teamBPlayer2)
  );

  if (!eligible) return;

  await prisma.$transaction([
    prisma.match.update({
      where: { id: eligible.id },
      data: { status: "IN_PROGRESS", courtNumber: freedCourt, startedAt: new Date() },
    }),
    prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    }),
  ]);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { deviceId, pointsA, pointsB, isOrganiserOverride, isOrganiserConfirm } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }
    if (!isOrganiserConfirm && (pointsA === undefined || pointsB === undefined)) {
      return NextResponse.json({ error: "pointsA, pointsB required" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({
      where: { id },
      include: { scoreSubmissions: true },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // ── Organiser confirm ─────────────────────────────────────────────────────
    if (isOrganiserConfirm) {
      const device = await prisma.device.findUnique({ where: { id: deviceId } });
      if (!device?.isOrganiser) {
        return NextResponse.json({ error: "Organiser access required" }, { status: 403 });
      }
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { scoreStatus: "CONFIRMED", status: "COMPLETE", completedAt: new Date() },
        }),
        prisma.session.update({ where: { id: match.sessionId }, data: { updatedAt: new Date() } }),
      ]);
      if (match.courtNumber) await autoAssignNextMatch(match.sessionId, match.courtNumber);
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    }

    // ── Organiser override (conflict resolution / direct score entry) ─────────
    if (isOrganiserOverride) {
      const device = await prisma.device.findUnique({ where: { id: deviceId } });
      if (!device?.isOrganiser) {
        return NextResponse.json({ error: "Organiser access required" }, { status: 403 });
      }
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { pointsA, pointsB, scoreStatus: "CONFIRMED", status: "COMPLETE", completedAt: new Date() },
        }),
        prisma.session.update({ where: { id: match.sessionId }, data: { updatedAt: new Date() } }),
      ]);
      if (match.courtNumber) await autoAssignNextMatch(match.sessionId, match.courtNumber);
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    }

    // ── Player submission ─────────────────────────────────────────────────────

    // Store or update this player's submission
    await prisma.scoreSubmission.upsert({
      where: { matchId_deviceId: { matchId: id, deviceId } },
      create: { matchId: id, deviceId, pointsA, pointsB },
      update: { pointsA, pointsB, submittedAt: new Date() },
    });

    // Re-fetch submissions after upsert to get the current full picture
    const allSubmissions = await prisma.scoreSubmission.findMany({
      where: { matchId: id },
    });

    // Only one submission so far — mark PENDING, wait for second
    if (allSubmissions.length < 2) {
      await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { scoreStatus: "PENDING" },
        }),
        prisma.session.update({
          where: { id: match.sessionId },
          data: { updatedAt: new Date() },
        }),
      ]);
      return NextResponse.json({ result: "PENDING" });
    }

    // Two or more submissions — check if they agree
    const [first, second] = allSubmissions;
    const scoresAgree = first.pointsA === second.pointsA && first.pointsB === second.pointsB;

    if (scoresAgree) {
      // Confirmed — complete the match and auto-assign next
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: {
            pointsA: first.pointsA,
            pointsB: first.pointsB,
            scoreStatus: "CONFIRMED",
            status: "COMPLETE",
            completedAt: new Date(),
          },
        }),
        prisma.session.update({
          where: { id: match.sessionId },
          data: { updatedAt: new Date() },
        }),
      ]);
      if (match.courtNumber) await autoAssignNextMatch(match.sessionId, match.courtNumber);
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    } else {
      // Conflict — flag for organiser to resolve
      await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { scoreStatus: "CONFLICT" },
        }),
        prisma.session.update({
          where: { id: match.sessionId },
          data: { updatedAt: new Date() },
        }),
      ]);
      return NextResponse.json({ result: "CONFLICT" });
    }

  } catch (err) {
    console.error("POST /api/matches/[id]/score error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PATCH: organiser edits a confirmed match score ────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { deviceId, pointsA, pointsB } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }
    if (pointsA === undefined || pointsB === undefined) {
      return NextResponse.json({ error: "pointsA and pointsB required" }, { status: 400 });
    }
    if (typeof pointsA !== "number" || typeof pointsB !== "number" || pointsA < 0 || pointsB < 0) {
      return NextResponse.json({ error: "pointsA and pointsB must be non-negative numbers" }, { status: 400 });
    }

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device?.isOrganiser) {
      return NextResponse.json({ error: "Organiser access required" }, { status: 403 });
    }

    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    if (match.status !== "COMPLETE") {
      return NextResponse.json({ error: "Can only edit completed matches" }, { status: 409 });
    }

    const [updated] = await prisma.$transaction([
      prisma.match.update({
        where: { id },
        data: { pointsA, pointsB, scoreStatus: "CONFIRMED" },
      }),
      prisma.session.update({
        where: { id: match.sessionId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ match: updated, result: "EDITED" });
  } catch (err) {
    console.error("PATCH /api/matches/[id]/score error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}