import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getAccount } from "../../../../../lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const account = await getAccount();
    if (!account) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await req.json();
    const { name, courts, pointsPerMatch, courtNames } = body;

    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.ownerAccountId !== account.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // courts and courtNames can only be changed in LOBBY
    if ((courts !== undefined || courtNames !== undefined) && session.status !== "LOBBY") {
      return NextResponse.json(
        { error: "Court settings can only be changed before the session starts" },
        { status: 400 }
      );
    }

    if (courts !== undefined && courts < 1) {
      return NextResponse.json({ error: "Courts must be at least 1" }, { status: 400 });
    }

    if (pointsPerMatch !== undefined) {
      if (typeof pointsPerMatch !== "number" || pointsPerMatch < 1) {
        return NextResponse.json({ error: "Points per match must be at least 1" }, { status: 400 });
      }
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
