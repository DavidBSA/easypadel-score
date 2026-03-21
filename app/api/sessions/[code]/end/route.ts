import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await req.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
      include: { matches: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Verify organiser
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device?.isOrganiser || device.sessionId !== session.id) {
      return NextResponse.json({ error: "Organiser access required" }, { status: 403 });
    }

    if (session.status !== "ACTIVE") {
      return NextResponse.json({ error: "Session is not active" }, { status: 409 });
    }

    // Safety check — no matches currently IN_PROGRESS
    const inProgress = session.matches.filter((m) => m.status === "IN_PROGRESS");
    if (inProgress.length > 0) {
      return NextResponse.json(
        { error: "Complete all in-progress matches before ending the session." },
        { status: 409 }
      );
    }

    // Mark session complete and bump updatedAt so SSE fires
    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { status: "COMPLETE", updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/sessions/[code]/end error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}