import { NextRequest } from "next/server";

const BASE_URL =
  process.env.LANGGRAPH_BASE_URL || "https://swift-agent-h60g.onrender.com";

export const runtime = "nodejs";

/**
 * Proxy POST /api/upload → Python backend /upload
 *
 * The browser sends multipart/form-data with:
 *   file      — the CSV / xlsx file
 *   thread_id — the active LangGraph thread ID
 *
 * We forward the raw multipart body to the backend and pipe the JSON response
 * back to the browser, keeping the backend URL server-side only.
 */
export async function POST(req: NextRequest) {
  // Forward the raw multipart body — do NOT call req.formData() here,
  // that would re-encode it. Pass body + content-type header straight through.
  const contentType = req.headers.get("content-type") ?? "";

  const upstream = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    headers: {
      // Forward the multipart content-type (with boundary)
      "Content-Type": contentType,
    },
    body: req.body,
    // Required for streaming body in Node.js fetch
    duplex: "half",
  } as RequestInit);

  const data = await upstream.json();

  return new Response(JSON.stringify(data), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
