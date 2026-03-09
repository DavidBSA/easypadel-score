import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { deviceId, pointsA, pointsB, isOrganiserOverride } = body;

    if (!deviceId || pointsA === undefined || pointsB === undefined) {
      return NextResponse.json(
        { error: "deviceId, pointsA, pointsB required" },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id },
      include: { scoreSubmissions: true },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // ── Organiser override ────────────────────────────────────────────────────
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
        prisma.session.update({ where: { id: match.sessionId }, data: {} }),
      ]);
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    }

    // ── Player submission ─────────────────────────────────────────────────────
    await prisma.scoreSubmission.upsert({
      where: { matchId_deviceId: { matchId: id, deviceId } },
      create: { matchId: id, deviceId, pointsA, pointsB },
      update: { pointsA, pointsB, submittedAt: new Date() },
    });

    const submissions = await prisma.scoreSubmission.findMany({
      where: { matchId: id },
    });

    // First submission — waiting for second
    if (submissions.length < 2) {
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { pointsA, pointsB, scoreStatus: "PENDING" },
        }),
        prisma.session.update({ where: { id: match.sessionId }, data: {} }),
      ]);
      return NextResponse.json({ match: updated, result: "PENDING" });
    }

    // Both submitted — check agreement
    const [s1, s2] = submissions;
    const agree = s1.pointsA === s2.pointsA && s1.pointsB === s2.pointsB;

    if (agree) {
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { pointsA: s1.pointsA, pointsB: s1.pointsB, scoreStatus: "CONFIRMED", status: "COMPLETE", completedAt: new Date() },
        }),
        prisma.session.update({ where: { id: match.sessionId }, data: {} }),
      ]);
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    } else {
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { scoreStatus: "CONFLICT" },
        }),
        prisma.session.update({ where: { id: match.sessionId }, data: {} }),
      ]);
      return NextResponse.json({
        match: updated,
        result: "CONFLICT",
        submissions: submissions.map((s: { deviceId: string; pointsA: number; pointsB: number }) => ({
          deviceId: s.deviceId, pointsA: s.pointsA, pointsB: s.pointsB,
        })),
      });
    }
  } catch (err) {
    console.error("POST /api/matches/[id]/score error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}