import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { generateMatchQueue, generateTeamMatchQueue } from "../../../../../lib/queue";
import type { QueueTeam } from "../../../../../lib/queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
      include: { players: true, devices: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "LOBBY") {
      return NextResponse.json({ error: "Session is already started." }, { status: 409 });
    }

    const body = await req.json();
    const { deviceId, teamA, teamB } = body;

    const device = session.devices.find((d) => d.id === deviceId && d.isOrganiser);
    if (!device) {
      return NextResponse.json({ error: "Organiser access required." }, { status: 403 });
    }

    const isSingle = session.format === "SINGLE";
    const isTeam   = session.format === "TEAM";
    const minPlayers = isSingle ? 4 : session.courts * 4;

    if (session.players.length < minPlayers) {
      return NextResponse.json(
        {
          error: isSingle
            ? "Single match requires exactly 4 players."
            : `Need at least ${minPlayers} players for ${session.courts} court${session.courts > 1 ? "s" : ""}.`,
        },
        { status: 400 }
      );
    }

    if (isTeam && session.players.length % 2 !== 0) {
      return NextResponse.json(
        { error: "Team Americano requires an even number of players." },
        { status: 400 }
      );
    }

    // Validate explicit SINGLE team assignment if provided
    if (isSingle && (teamA || teamB)) {
      const validIds = new Set(session.players.map((p) => p.id));
      const provided: string[] = [...(teamA ?? []), ...(teamB ?? [])];
      if (
        !Array.isArray(teamA) || teamA.length !== 2 ||
        !Array.isArray(teamB) || teamB.length !== 2 ||
        provided.some((id) => !validIds.has(id)) ||
        new Set(provided).size !== 4
      ) {
        return NextResponse.json(
          { error: "Invalid team assignment — provide exactly 2 unique players per team." },
          { status: 400 }
        );
      }
    }

    let queueMatches: {
      queuePosition: number;
      teamAPlayer1: string;
      teamAPlayer2: string;
      teamBPlayer1: string;
      teamBPlayer2: string;
    }[];

    if (isSingle) {
      // Use explicit assignment if provided, otherwise fall back to join order
      const useExplicit = Array.isArray(teamA) && teamA.length === 2 &&
                          Array.isArray(teamB) && teamB.length === 2;
      if (useExplicit) {
        queueMatches = [{
          queuePosition: 0,
          teamAPlayer1: teamA[0],
          teamAPlayer2: teamA[1],
          teamBPlayer1: teamB[0],
          teamBPlayer2: teamB[1],
        }];
      } else {
        const [p1, p2, p3, p4] = session.players;
        queueMatches = [{
          queuePosition: 0,
          teamAPlayer1: p1.id,
          teamAPlayer2: p2.id,
          teamBPlayer1: p3.id,
          teamBPlayer2: p4.id,
        }];
      }
    } else if (isTeam) {
      const teams: QueueTeam[] = [];
      for (let i = 0; i + 1 < session.players.length; i += 2) {
        const p1 = session.players[i];
        const p2 = session.players[i + 1];
        teams.push({
          id: `${p1.id}_${p2.id}`,
          player1Id: p1.id,
          player2Id: p2.id,
          isActive: true,
        });
      }
      queueMatches = generateTeamMatchQueue(teams, session.courts);
    } else {
      // MIXED
      queueMatches = generateMatchQueue(
        session.players.map((p) => ({ id: p.id, name: p.name, isActive: true })),
        session.courts
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.match.createMany({
        data: queueMatches.map((m) => ({
          sessionId: session.id,
          queuePosition: m.queuePosition,
          teamAPlayer1: m.teamAPlayer1,
          teamAPlayer2: m.teamAPlayer2,
          teamBPlayer1: m.teamBPlayer1,
          teamBPlayer2: m.teamBPlayer2,
        })),
      });

      await tx.session.update({
        where: { id: session.id },
        data: { status: "ACTIVE" },
      });
    });

    const createdMatches = await prisma.match.findMany({
      where: { sessionId: session.id },
      orderBy: { queuePosition: "asc" },
    });

    const courtsToFill = isSingle ? 1 : session.courts;
    const autoAssign = createdMatches.slice(0, courtsToFill);

    await prisma.$transaction([
      ...autoAssign.map((m, idx) =>
        prisma.match.update({
          where: { id: m.id },
          data: {
            status: "IN_PROGRESS",
            courtNumber: idx + 1,
            startedAt: new Date(),
          },
        })
      ),
      prisma.session.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/sessions/[code]/start error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}