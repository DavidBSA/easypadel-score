import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await params;
    const body = await req.json();
    const { deviceId } = body;

    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
      include: { devices: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "LOBBY") {
      return NextResponse.json(
        { error: "Cannot remove players after the session has started" },
        { status: 400 }
      );
    }

    const device = session.devices.find((d) => d.id === deviceId);
    if (!device?.isOrganiser) {
      return NextResponse.json({ error: "Organiser access required" }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.player.delete({ where: { id } }),
      prisma.session.update({ where: { id: session.id }, data: { updatedAt: new Date() } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sessions/[code]/players/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
