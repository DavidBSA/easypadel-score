import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

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

    // ── Organiser confirm (lock PENDING score as-is, no value change) ─────────
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
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    }

    // ── Organiser override (conflict resolution — sets new score values) ──────
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
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    }

    // ── Player submission ─────────────────────────────────────────────────────
    await prisma.scoreSubmission.upsert({
      where: { matchId_deviceId: { matchId: id, deviceId } },
      create: { matchId: id, deviceId, pointsA, pointsB },
      update: { pointsA, pointsB, submittedAt: new Date() },
    });

    const submissions = await prisma.scoreSubmission.findMany({ where: { matchId: id } });

    // First submission — store score, wait for organiser confirm or second submission
    if (submissions.length < 2) {
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { pointsA, pointsB, scoreStatus: "PENDING" },
        }),
        prisma.session.update({ where: { id: match.sessionId }, data: { updatedAt: new Date() } }),
      ]);
      return NextResponse.json({ match: updated, result: "PENDING" });
    }

    // Two submissions — check agreement
    const [s1, s2] = submissions;
    const agree = s1.pointsA === s2.pointsA && s1.pointsB === s2.pointsB;

    if (agree) {
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { pointsA: s1.pointsA, pointsB: s1.pointsB, scoreStatus: "CONFIRMED", status: "COMPLETE", completedAt: new Date() },
        }),
        prisma.session.update({ where: { id: match.sessionId }, data: { updatedAt: new Date() } }),
      ]);
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    } else {
      const [updated] = await prisma.$transaction([
        prisma.match.update({
          where: { id },
          data: { scoreStatus: "CONFLICT" },
        }),
        prisma.session.update({ where: { id: match.sessionId }, data: { updatedAt: new Date() } }),
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