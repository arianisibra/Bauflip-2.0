import "server-only";

import { getCurrentSession } from "@/lib/auth/session";
import { subscribe, type PublishedEvent } from "@/lib/sse/hub";

// SSE must stream — never static, never cached.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function sseFrame(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function sseComment(text: string): Uint8Array {
  return encoder.encode(`: ${text}\n\n`);
}

export async function GET(request: Request): Promise<Response> {
  const session = await getCurrentSession();
  if (!session?.organizationId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const orgId = session.organizationId;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      // Initial comment so the browser commits the connection immediately.
      safeEnqueue(sseComment("connected"));

      // Heartbeat every 20s to keep proxies from closing idle connections.
      const heartbeat = setInterval(() => safeEnqueue(sseComment("keep-alive")), 20_000);

      const unsubscribe = subscribe(orgId, (event: PublishedEvent) => {
        safeEnqueue(sseFrame(event));
      });

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable nginx / upstream buffering (no-op elsewhere).
      "X-Accel-Buffering": "no",
    },
  });
}
