import { NextRequest } from "next/server";

const BASE_URL =
  process.env.LANGGRAPH_BASE_URL || "https://swift-agent-h60g.onrender.com";
const GRAPH_ID = process.env.LANGGRAPH_GRAPH_ID || "swift";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { threadId, input, command } = body as {
    threadId?: string;
    input?: { messages: { role: string; content: string }[] };
    command?: { resume: unknown };
  };

  // ── 1. Create a thread if we don't have one ────────────────────
  let tid = threadId;
  if (!tid) {
    const res = await fetch(`${BASE_URL}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to create thread: ${res.status}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    const data = (await res.json()) as { thread_id: string };
    tid = data.thread_id;
  }

  // ── 2. Build the stream payload ────────────────────────────────
  // assistant_id is required by LangGraph Cloud — it maps to the graph name
  const streamPayload: Record<string, unknown> = {
    assistant_id: GRAPH_ID,
    stream_mode: ["messages", "values"],
  };

  if (command) {
    streamPayload.command = command;
  } else if (input) {
    streamPayload.input = input;
  }

  // ── 3. Open the SSE stream from LangGraph ──────────────────────
  const upstream = await fetch(`${BASE_URL}/threads/${tid}/runs/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(streamPayload),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "unknown error");
    return new Response(
      JSON.stringify({ error: `Stream failed: ${upstream.status} — ${text}` }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── 4. Pipe the SSE back to the browser ───────────────────────
  // Prepend a `thread_id` meta event so the client can persist it.
  const encoder = new TextEncoder();
  const metaEvent =
    `event: thread_id\ndata: ${JSON.stringify({ thread_id: tid })}\n\n`;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Write the meta event first
  writer.write(encoder.encode(metaEvent));

  // Pipe the upstream body
  (async () => {
    const reader = upstream.body!.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch {
      // upstream closed
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Thread-Id": tid,
    },
  });
}
