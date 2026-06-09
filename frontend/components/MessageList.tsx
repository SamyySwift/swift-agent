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
}

// ── Empty state ───────────────────────────────────────────────────
function EmptyState() {
  const suggestions = [
    "List all my Supabase projects",
    "Show the tables in my database",
    "What extensions are enabled?",
    "Create a new Supabase project",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6 py-16">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            boxShadow: "0 0 40px rgba(99,102,241,0.35)",
          }}
        >
          ⚡
        </div>
        <div className="text-center">
          <h1
            className="text-2xl font-bold"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Swift Agent
          </h1>
          <p className="text-sm mt-1" style={{ color: "#475569" }}>
            AI-powered Supabase management
          </p>
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {suggestions.map((s) => (
          <div
            key={s}
            className="px-4 py-3 rounded-xl text-sm cursor-default"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8",
            }}
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────────
export default function MessageList({ items, isStreaming, onInterruptDecide }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  if (items.length === 0 && !isStreaming) {
    return <EmptyState />;
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
                <div className="flex justify-center w-full">
                  <div className="w-full max-w-2xl">
                    <ToolCallCard
                      key={item.id}
                      id={item.id}
                      name={(item as ToolCallItem).name}
                      args={(item as ToolCallItem).args}
                    />
                  </div>
                </div>
              );
            case "tool_result":
              return (
                <div className="flex justify-center w-full">
                  <div className="w-full max-w-2xl">
                    <ToolResultCard
                      key={item.id}
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
                <div className="flex justify-center w-full">
                  <div className="w-full max-w-2xl">
                    <InterruptCard
                      key={item.id}
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

        {/* Show placeholder streaming bubble only if last item isn't already an AI one */}
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
