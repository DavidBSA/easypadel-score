import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await prisma.session.findUnique({
      where: { code: params.code.toUpperCase() },
      include: {
        players: { orderBy: { createdAt: "asc" } },
        matches: {
          orderBy: { queuePosition: "asc" },
          include: { scoreSubmissions: true },
        },
        devices: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error("GET /api/sessions/[code] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}