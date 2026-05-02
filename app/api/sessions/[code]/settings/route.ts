import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { organiserPin, name, courts, pointsPerMatch, courtNames } = body;

    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (organiserPin !== session.organiserPin) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 403 });
    }

    if (session.status !== "LOBBY") {
      return NextResponse.json(
        { error: "Session has already started — settings cannot be changed" },
        { status: 400 }
      );
    }

    if (courts !== undefined && courts < 1) {
      return NextResponse.json({ error: "Courts must be at least 1" }, { status: 400 });
    }

    if (pointsPerMatch !== undefined && pointsPerMatch < 1) {
      return NextResponse.json({ error: "Points per match must be at least 1" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (courts !== undefined) updateData.courts = courts;
    if (pointsPerMatch !== undefined) updateData.pointsPerMatch = pointsPerMatch;
    if (courtNames !== undefined) updateData.courtNames = courtNames;

    const updated = await prisma.$transaction(async (tx) => {
      return tx.session.update({
        where: { id: session.id },
        data: updateData,
      });
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/sessions/[code]/settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
