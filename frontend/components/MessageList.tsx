"use client";

import { useEffect, useRef } from "react";
import type {
  AIItem,
  ChatItem,
  HumanItem,
  InterruptDecision,
  InterruptItem,
  ToolCallItem,
  ToolResultItem,
  ErrorItem,
} from "@/lib/types";
import { AIBubble, ErrorBubble, HumanBubble } from "./MessageBubble";
import ToolCallCard from "./ToolCallCard";
import ToolResultCard from "./ToolResultCard";
import InterruptCard from "./InterruptCard";

interface Props {
  items: ChatItem[];
  isStreaming: boolean;
  onInterruptDecide: (id: string, decision: InterruptDecision) => void;
  onSuggestionClick?: (text: string) => void;
}

// ── Suggestion card data ─────────────────────────────────────────
const SUGGESTIONS = [
  {
    icon: "◈",
    label: "List projects",
    prompt: "List all my Supabase projects",
    desc: "View all connected projects",
  },
  {
    icon: "⬡",
    label: "Explore tables",
    prompt: "Show the tables in my database",
    desc: "Browse your schema structure",
  },
  {
    icon: "◎",
    label: "Extensions",
    prompt: "What extensions are enabled?",
    desc: "Check active Postgres extensions",
  },
  {
    icon: "⊕",
    label: "New project",
    prompt: "Create a new Supabase project",
    desc: "Spin up a new environment",
  },
];

// ── Empty state ───────────────────────────────────────────────────
function EmptyState({ onSuggestionClick }: { onSuggestionClick?: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-6 py-16">
      {/* Logo + heading */}
      <div className="flex flex-col items-center gap-5 text-center">
        {/* Logo mark */}
        <div className="relative">
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
              transform: "scale(2.5)",
            }}
          />
          <div
            className="logo-glow relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #606060 100%)",
            }}
          >
            <span style={{ filter: "invert(1)", fontSize: "20px" }}>⚡</span>
          </div>
        </div>

        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              background: "linear-gradient(135deg, #ffffff 20%, #4a4a4a 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              letterSpacing: "-0.03em",
            }}
          >
            Swift Agent
          </h1>
          <p
            className="text-sm mt-2 font-light"
            style={{ color: "#3a3a3a", letterSpacing: "0.02em" }}
          >
            AI-powered Supabase management
          </p>
        </div>
      </div>

      {/* Suggestion cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s.prompt}
            id={`suggestion-${i}`}
            onClick={() => onSuggestionClick?.(s.prompt)}
            className="suggestion-card text-left px-4 py-4 rounded-2xl cursor-pointer group"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              animationDelay: `${i * 60}ms`,
              animationFillMode: "both",
            }}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-base transition-all duration-300 group-hover:scale-110"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "14px",
                }}
              >
                {s.icon}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium truncate transition-colors duration-200 group-hover:text-white"
                  style={{ color: "#888888", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.01em" }}
                >
                  {s.label}
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: "#333333", letterSpacing: "0.01em" }}
                >
                  {s.desc}
                </p>
              </div>

              {/* Arrow */}
              <svg
                className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-30 transition-all duration-200 group-hover:translate-x-0.5"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                style={{ color: "white" }}
              >
                <path
                  d="M2 6h8M6 2l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom hint */}
      <p
        className="text-xs"
        style={{ color: "#222222", letterSpacing: "0.03em" }}
      >
        or type a message below to get started
      </p>
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────────
export default function MessageList({
  items,
  isStreaming,
  onInterruptDecide,
  onSuggestionClick,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  if (items.length === 0 && !isStreaming) {
    return <EmptyState onSuggestionClick={onSuggestionClick} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
        {items.map((item) => {
          switch (item.kind) {
            case "human":
              return <HumanBubble key={item.id} item={item as HumanItem} />;
            case "ai":
              return <AIBubble key={item.id} item={item as AIItem} />;
            case "tool_call":
              return (
                <div key={item.id} className="flex justify-center w-full">
                  <div className="w-full max-w-2xl">
                    <ToolCallCard
                      id={item.id}
                      name={(item as ToolCallItem).name}
                      args={(item as ToolCallItem).args}
                    />
                  </div>
                </div>
              );
            case "tool_result":
              return (
                <div key={item.id} className="flex justify-center w-full">
                  <div className="w-full max-w-2xl">
                    <ToolResultCard
                      id={item.id}
                      name={(item as ToolResultItem).name}
                      content={(item as ToolResultItem).content}
                      isError={(item as ToolResultItem).isError}
                    />
                  </div>
                </div>
              );
            case "interrupt":
              return (
                <div key={item.id} className="flex justify-center w-full">
                  <div className="w-full max-w-2xl">
                    <InterruptCard
                      payload={(item as InterruptItem).payload}
                      onDecide={(decision) => onInterruptDecide(item.id, decision)}
                      disabled={(item as InterruptItem).resolved}
                    />
                  </div>
                </div>
              );
            case "error":
              return (
                <ErrorBubble key={item.id} message={(item as ErrorItem).message} />
              );
          }
        })}

        {/* Streaming placeholder */}
        {isStreaming &&
          items.length > 0 &&
          items[items.length - 1].kind !== "ai" && (
            <AIBubble
              item={{ kind: "ai", id: "streaming-placeholder", text: "", streaming: true }}
            />
          )}
        {isStreaming && items.length === 0 && (
          <AIBubble
            item={{ kind: "ai", id: "streaming-placeholder", text: "", streaming: true }}
          />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
