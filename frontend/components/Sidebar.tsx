"use client";

import type { ThreadMeta } from "@/lib/types";

interface Props {
  threads: ThreadMeta[];
  activeThreadId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Sidebar({
  threads,
  activeThreadId,
  onSelect,
  onNewChat,
}: Props) {
  return (
    <aside
      className="hidden md:flex flex-col w-64 shrink-0 h-full overflow-hidden"
      style={{
        background: "#0d1625",
        borderRight: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            boxShadow: "0 0 20px rgba(99,102,241,0.4)",
          }}
        >
          ⚡
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-white truncate">Swift Agent</p>
          <p className="text-xs truncate" style={{ color: "#64748b" }}>
            Supabase AI
          </p>
        </div>
      </div>

      {/* ── New Chat ───────────────────────────────────────────── */}
      <div className="px-3 py-3 shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            boxShadow: "0 2px 14px rgba(99,102,241,0.35)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Chat
        </button>
      </div>

      {/* ── Thread list ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {threads.length === 0 ? (
          <div className="px-3 mt-4 text-center">
            <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>
              No conversations yet.
              <br />
              Start by sending a message.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {threads.map((t) => {
              const isActive = t.threadId === activeThreadId;
              return (
                <button
                  key={t.threadId}
                  onClick={() => onSelect(t.threadId)}
                  className="w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150"
                  style={{
                    background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                    border: isActive
                      ? "1px solid rgba(99,102,241,0.25)"
                      : "1px solid transparent",
                  }}
                >
                  <p
                    className="text-sm truncate font-medium"
                    style={{ color: isActive ? "#e2e8f0" : "#94a3b8" }}
                  >
                    {t.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#475569" }}>
                    {timeAgo(t.createdAt)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-xs" style={{ color: "#334155" }}>Connected to LangGraph</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "#1e293b" }}>
          swift-agent-h60g.onrender.com
        </p>
      </div>
    </aside>
  );
}
