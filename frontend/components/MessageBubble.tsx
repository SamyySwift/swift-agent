"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIItem, HumanItem } from "@/lib/types";

// ── Human bubble ─────────────────────────────────────────────────
export function HumanBubble({ item }: { item: HumanItem }) {
  return (
    <div className="flex justify-end animate-in">
      <div
        className="max-w-[78%] px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed font-medium"
        style={{
          background: "linear-gradient(135deg, var(--accent-from), var(--accent-to))",
          color: "#111111",
          boxShadow: "0 2px 16px var(--accent-glow)",
        }}
      >
        {item.text}
      </div>
    </div>
  );
}


// ── AI bubble ────────────────────────────────────────────────────
export function AIBubble({ item }: { item: AIItem }) {
  return (
    <div className="flex items-start gap-3 animate-in">
      {/* Avatar */}
      <div
        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
        style={{
          background: "linear-gradient(135deg, var(--accent-from), var(--accent-to))",
          boxShadow: "0 0 14px var(--accent-glow)",
        }}
      >
        <span style={{ filter: "invert(1)" }}>⚡</span>
      </div>

      {/* Bubble */}
      <div
        className="min-w-0 max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm text-sm"
        style={{
          background: "var(--glass)",
          border: "1px solid var(--border)",
          borderLeft: "2px solid var(--accent-from)",
        }}
      >
        {item.text ? (
          <div className={`prose-chat${item.streaming ? " cursor-blink" : ""}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {item.text}
            </ReactMarkdown>
          </div>
        ) : (
          // Empty streaming — show animated dots
          <div className="flex items-center gap-1.5 py-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="pulse-dot"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Error bubble ─────────────────────────────────────────────────
export function ErrorBubble({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 animate-in">
      <div
        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm"
        style={{ background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.3)" }}
      >
        ⚠️
      </div>
      <div
        className="flex-1 px-4 py-3 rounded-2xl rounded-tl-sm text-sm"
        style={{
          background: "var(--red-dim)",
          border: "1px solid rgba(239,68,68,0.25)",
          color: "#fca5a5",
        }}
      >
        {message}
      </div>
    </div>
  );
}
