import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { deviceId, pointsA, pointsB, isOrganiserOverride } = body;

    if (!deviceId || pointsA === undefined || pointsB === undefined) {
      return NextResponse.json(
        { error: "deviceId, pointsA, pointsB required" },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: { scoreSubmissions: true },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Organiser override — force confirm regardless
    if (isOrganiserOverride) {
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
      });
      if (!device?.isOrganiser) {
        return NextResponse.json(
          { error: "Organiser access required" },
          { status: 403 }
        );
      }

      const updated = await prisma.match.update({
        where: { id: params.id },
        data: {
          pointsA,
          pointsB,
          scoreStatus: "CONFIRMED",
          status: "COMPLETE",
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    }

    // Normal submission — upsert this device's score
    await prisma.scoreSubmission.upsert({
      where: { matchId_deviceId: { matchId: params.id, deviceId } },
      create: { matchId: params.id, deviceId, pointsA, pointsB },
      update: { pointsA, pointsB, submittedAt: new Date() },
    });

    // Reload all submissions
    const submissions = await prisma.scoreSubmission.findMany({
      where: { matchId: params.id },
    });

    // Only one submission so far — mark as pending confirmation
    if (submissions.length < 2) {
      const updated = await prisma.match.update({
        where: { id: params.id },
        data: { pointsA, pointsB, scoreStatus: "PENDING" },
      });
      return NextResponse.json({ match: updated, result: "PENDING" });
    }

    // Two submissions — check if they agree
    const [s1, s2] = submissions;
    const agree = s1.pointsA === s2.pointsA && s1.pointsB === s2.pointsB;

    if (agree) {
      const updated = await prisma.match.update({
        where: { id: params.id },
        data: {
          pointsA: s1.pointsA,
          pointsB: s1.pointsB,
          scoreStatus: "CONFIRMED",
          status: "COMPLETE",
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ match: updated, result: "CONFIRMED" });
    } else {
      // Conflict — flag for organiser
      const updated = await prisma.match.update({
        where: { id: params.id },
        data: {
          scoreStatus: "CONFLICT",
          // Store both submissions in a way organiser can see
          // pointsA/B remain null until resolved
        },
      });
      return NextResponse.json({
        match: updated,
        result: "CONFLICT",
        submissions: submissions.map((s: { deviceId: string; pointsA: number; pointsB: number }) => ({
          deviceId: s.deviceId,
          pointsA: s.pointsA,
          pointsB: s.pointsB,
        })),
      });
    }
  } catch (err) {
    console.error("POST /api/matches/[id]/score error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}