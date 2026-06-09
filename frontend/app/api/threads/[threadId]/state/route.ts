import { NextRequest } from "next/server";

const BASE_URL =
  process.env.LANGGRAPH_BASE_URL || "https://swift-agent-h60g.onrender.com";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;

  const res = await fetch(`${BASE_URL}/threads/${threadId}/state`, {
    headers: { "Content-Type": "application/json" },
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
