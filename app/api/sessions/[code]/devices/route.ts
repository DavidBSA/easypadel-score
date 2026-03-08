import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await prisma.session.findUnique({
      where: { code: params.code.toUpperCase() },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await req.json();
    const { organiserPin, courtNumber } = body;

    const isOrganiser =
      !!organiserPin && organiserPin === session.organiserPin;

    const device = await prisma.device.create({
      data: {
        sessionId: session.id,
        isOrganiser,
        courtNumber: courtNumber ?? null,
      },
    });

    return NextResponse.json({
      deviceId: device.id,
      isOrganiser: device.isOrganiser,
      sessionId: session.id,
      code: session.code,
    });
  } catch (err) {
    console.error("POST /api/sessions/[code]/devices error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}