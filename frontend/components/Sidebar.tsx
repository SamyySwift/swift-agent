"use client";

import { useState } from "react";
import type { ThreadMeta } from "@/lib/types";

interface Props {
  threads: ThreadMeta[];
  activeThreadId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
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

// ── Thread icon — generates a consistent monogram ─────────────────
function ThreadIcon({ title }: { title: string }) {
  const letter = title.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.5)",
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: "0.02em",
      }}
    >
      {letter}
    </div>
  );
}

export default function Sidebar({
  threads,
  activeThreadId,
  isOpen,
  onClose,
  onSelect,
  onNewChat,
  onDelete,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function handleDeleteClick(e: React.MouseEvent, tid: string) {
    e.stopPropagation();
    if (pendingDelete === tid) {
      onDelete(tid);
      setPendingDelete(null);
    } else {
      setPendingDelete(tid);
    }
  }

  function handleRowClick(tid: string) {
    setPendingDelete(null);
    onSelect(tid);
    onClose(); // Close sidebar on mobile after selecting a chat
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 shrink-0 h-full overflow-hidden transition-transform duration-300 ease-out md:relative md:translate-x-0 md:flex ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "#070707",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
      {/* Subtle top-left radial */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 40% at 0% 0%, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      {/* ── Brand ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 py-5 shrink-0 relative"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Logo mark */}
        <div
          className="logo-glow w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-black"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #888888 100%)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="font-bold text-sm truncate"
            style={{
              color: "#f0f0f0",
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            Swift Agent
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#22c55e" }}
            />
            <p className="text-xs" style={{ color: "#444444", letterSpacing: "0.02em" }}>
              online
            </p>
          </div>
        </div>

        {/* Model badge */}
        <div
          className="shrink-0 text-xs px-2 py-0.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#555555",
            fontFamily: "monospace",
            fontSize: "9px",
            letterSpacing: "0.05em",
          }}
        >
          AI
        </div>
      </div>

      {/* ── New Chat ───────────────────────────────────────────── */}
      <div className="px-3 pt-4 pb-2 shrink-0">
        <button
          onClick={onNewChat}
          id="new-chat-btn"
          className="group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
            e.currentTarget.style.color = "rgba(255,255,255,0.9)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            e.currentTarget.style.color = "rgba(255,255,255,0.7)";
          }}
        >
          {/* Plus icon */}
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M5 1v8M1 5h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.01em" }}>
            New conversation
          </span>
        </button>
      </div>

      {/* ── Section label ───────────────────────────────────────── */}
      {threads.length > 0 && (
        <div className="px-5 pb-2 pt-3 shrink-0">
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: "#333333", letterSpacing: "0.1em", fontSize: "10px" }}
          >
            History
          </p>
        </div>
      )}

      {/* ── Thread list ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {threads.length === 0 ? (
          <div className="px-4 mt-6 text-center">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl mx-auto mb-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              💬
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#333333" }}>
              No conversations yet
            </p>
            <p className="text-xs mt-1" style={{ color: "#222222" }}>
              Start by sending a message below
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {threads.map((t) => {
              const isActive = t.threadId === activeThreadId;
              const isConfirming = pendingDelete === t.threadId;
              const isHovered = hoveredId === t.threadId;

              return (
                <div
                  key={t.threadId}
                  className="thread-row group relative flex items-center rounded-xl"
                  style={{
                    background: isActive
                      ? "rgba(255,255,255,0.07)"
                      : "transparent",
                    border: isActive
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid transparent",
                  }}
                  onMouseEnter={() => setHoveredId(t.threadId)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                      style={{ background: "rgba(255,255,255,0.4)" }}
                    />
                  )}

                  {/* Main clickable area */}
                  <button
                    onClick={() => handleRowClick(t.threadId)}
                    className="flex-1 min-w-0 text-left px-3 py-2.5 flex items-center gap-2.5"
                  >
                    <ThreadIcon title={t.title} />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-xs truncate"
                        style={{
                          color: isActive ? "#e8e8e8" : "#666666",
                          fontWeight: isActive ? 500 : 400,
                          letterSpacing: "-0.005em",
                          lineHeight: 1.4,
                        }}
                      >
                        {t.title}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{
                          color: "#2e2e2e",
                          fontSize: "10px",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {timeAgo(t.createdAt)}
                      </p>
                    </div>
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteClick(e, t.threadId)}
                    onBlur={() => {
                      if (pendingDelete === t.threadId) setPendingDelete(null);
                    }}
                    aria-label={isConfirming ? "Confirm delete" : "Delete thread"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150"
                    style={{
                      opacity: isConfirming || isHovered ? 1 : 0,
                      background: isConfirming
                        ? "rgba(239,68,68,0.15)"
                        : "rgba(255,255,255,0.04)",
                      color: isConfirming ? "#ef4444" : "#444444",
                    }}
                  >
                    {isConfirming ? (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M1.5 3h9M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 5.5v3M7 5.5v3M2.5 3l.5 7a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5l.5-7"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div
        className="px-5 py-4 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: "#22c55e" }}
          />
          <p className="text-xs truncate" style={{ color: "#2e2e2e", letterSpacing: "0.01em" }}>
            swift-agent-h60g.onrender.com
          </p>
        </div>
        <p
          className="text-xs mt-1"
          style={{ color: "#1e1e1e", fontSize: "10px", letterSpacing: "0.03em" }}
        >
          Powered by LangGraph
        </p>
      </div>
    </aside>
    </>
  );
}
