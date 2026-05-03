import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

async function autoAssignNextMatches(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { courts: true },
  });
  if (!session) return;

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
  for (let i = 1; i <= session.courts; i++) {
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
      await autoAssignNextMatches(match.sessionId);
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
      await autoAssignNextMatches(match.sessionId);
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

    // First submission auto-confirms immediately — no second submission required.
    // If a second submission arrives with a different score, it becomes a conflict
    // for the organiser to resolve.
    const firstSubmission = allSubmissions[0];

    if (allSubmissions.length === 1) {
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: {
            pointsA: firstSubmission.pointsA,
            pointsB: firstSubmission.pointsB,
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
      await autoAssignNextMatches(match.sessionId);
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    }

    // Second or subsequent submission — check against the confirmed score
    const [first, second] = allSubmissions;
    const scoresAgree = first.pointsA === second.pointsA && first.pointsB === second.pointsB;

    if (scoresAgree) {
      return NextResponse.json({ result: "CONFIRMED" });
    } else {
      // Scores disagree — flag conflict for organiser
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