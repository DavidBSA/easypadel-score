import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

const POLL_INTERVAL = 2000;
const KEEPALIVE_INTERVAL = 15000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const session = await prisma.session.findUnique({
    where: { code: code.toUpperCase() },
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

      function enqueue(chunk: string) {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          active = false;
        }
      }

      async function sendState() {
        if (!active) return;
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
          if (data.updatedAt <= lastUpdatedAt) return;
          lastUpdatedAt = data.updatedAt;

          enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          active = false;
          try { controller.close(); } catch { /* already closed */ }
        }
      }

      await sendState();

      // Poll for DB changes every 2s
      const pollInterval = setInterval(async () => {
        if (!active) { clearInterval(pollInterval); return; }
        await sendState();
      }, POLL_INTERVAL);

      // Keepalive comment frame every 15s — prevents Railway/proxies killing the connection
      const keepaliveInterval = setInterval(() => {
        if (!active) { clearInterval(keepaliveInterval); return; }
        enqueue(": keepalive\n\n");
      }, KEEPALIVE_INTERVAL);

      req.signal.addEventListener("abort", () => {
        active = false;
        clearInterval(pollInterval);
        clearInterval(keepaliveInterval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}