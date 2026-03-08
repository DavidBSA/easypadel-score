import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

// Poll interval in ms — low enough to feel live, high enough to not hammer DB
const POLL_INTERVAL = 2000;

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const session = await prisma.session.findUnique({
    where: { code: params.code.toUpperCase() },
  });

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  const sessionId = session.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastUpdatedAt = new Date(0);
      let active = true;

      // Send initial state immediately
      async function sendState() {
        try {
          const data = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
              players: { orderBy: { createdAt: "asc" } },
              matches: {
                orderBy: { queuePosition: "asc" },
                include: { scoreSubmissions: true },
              },
            },
          });

          if (!data) return;

          // Only send if something changed
          if (data.updatedAt <= lastUpdatedAt) return;
          lastUpdatedAt = data.updatedAt;

          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          active = false;
          controller.close();
        }
      }

      await sendState();

      // Poll for changes
      const interval = setInterval(async () => {
        if (!active) { clearInterval(interval); return; }
        await sendState();
      }, POLL_INTERVAL);

      // Clean up on disconnect
      req.signal.addEventListener("abort", () => {
        active = false;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}