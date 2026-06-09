"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AIItem,
  ChatItem,
  InterruptDecision,
  ThreadMeta,
} from "@/lib/types";
import { streamRun } from "@/lib/langgraph";
import Sidebar from "./Sidebar";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";

const THREADS_KEY = "swift_threads";

function loadThreads(): ThreadMeta[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(THREADS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveThreads(threads: ThreadMeta[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
}

function upsertItem(items: ChatItem[], next: ChatItem): ChatItem[] {
  const idx = items.findIndex((i) => i.id === next.id);
  if (idx === -1) return [...items, next];
  const copy = [...items];
  copy[idx] = next;
  return copy;
}

export default function ChatShell() {
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadItems, setThreadItems] = useState<Record<string, ChatItem[]>>({});
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    setThreads(loadThreads());
  }, []);

  const items: ChatItem[] = activeThreadId
    ? (threadItems[activeThreadId] ?? [])
    : [];

  const mutate = useCallback(
    (tid: string, fn: (prev: ChatItem[]) => ChatItem[]) => {
      setThreadItems((prev) => ({ ...prev, [tid]: fn(prev[tid] ?? []) }));
    },
    []
  );

  const registerThread = useCallback((tid: string, title: string) => {
    setThreads((prev) => {
      if (prev.find((t) => t.threadId === tid)) return prev;
      const next: ThreadMeta[] = [
        { threadId: tid, title, createdAt: Date.now() },
        ...prev,
      ];
      saveThreads(next);
      return next;
    });
  }, []);

  // ── Core streaming runner ─────────────────────────────────────
  const runStream = useCallback(
    async (opts: {
      threadId?: string;
      input?: { messages: { role: string; content: string }[] };
      command?: { resume: unknown };
      title?: string;
      humanItem?: ChatItem;
    }) => {
      setIsStreaming(true);
      let resolvedTid = opts.threadId ?? null;
      let registeredHuman = false;

      try {
        for await (const event of streamRun({
          threadId: opts.threadId,
          input: opts.input,
          command: opts.command,
          onThreadId: (tid) => {
            resolvedTid = tid;
            setActiveThreadId(tid);
            if (opts.title) registerThread(tid, opts.title);
            // Backfill the human message now that we have a thread id
            if (opts.humanItem && !registeredHuman) {
              registeredHuman = true;
              setThreadItems((prev) => {
                const existing = prev[tid] ?? [];
                if (existing.find((i) => i.id === opts.humanItem!.id))
                  return prev;
                return { ...prev, [tid]: [opts.humanItem!, ...existing] };
              });
            }
          },
        })) {
          const tid = resolvedTid;
          if (!tid) continue;

          if (event.kind === "ai") {
            mutate(tid, (prev) => upsertItem(prev, event as AIItem));
          } else {
            mutate(tid, (prev) => [...prev, event]);
          }
        }
      } catch (err) {
        if (resolvedTid) {
          mutate(resolvedTid, (prev) => [
            ...prev,
            { kind: "error", id: crypto.randomUUID(), message: String(err) },
          ]);
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [mutate, registerThread]
  );

  // ── Send new user message ─────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      const humanItem: ChatItem = {
        kind: "human",
        id: crypto.randomUUID(),
        text,
      };

      // If we already have a thread, add the human message immediately
      if (activeThreadId) {
        mutate(activeThreadId, (prev) => [...prev, humanItem]);
      }

      await runStream({
        threadId: activeThreadId ?? undefined,
        input: { messages: [{ role: "human", content: text }] },
        title: text.slice(0, 48),
        humanItem: activeThreadId ? undefined : humanItem,
      });
    },
    [activeThreadId, isStreaming, mutate, runStream]
  );

  // ── Handle interrupt decision ─────────────────────────────────
  const handleInterruptDecide = useCallback(
    async (itemId: string, decision: InterruptDecision) => {
      if (!activeThreadId || isStreaming) return;

      mutate(activeThreadId, (prev) =>
        prev.map((item) =>
          item.id === itemId && item.kind === "interrupt"
            ? { ...item, resolved: true }
            : item
        )
      );

      await runStream({
        threadId: activeThreadId,
        command: { resume: decision },
      });
    },
    [activeThreadId, isStreaming, mutate, runStream]
  );

  const handleNewChat = useCallback(() => setActiveThreadId(null), []);
  const handleSelectThread = useCallback(
    (tid: string) => setActiveThreadId(tid),
    []
  );

  return (
    <div
      className="flex"
      style={{ height: "100dvh", background: "#060b14" }}
    >
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelect={handleSelectThread}
        onNewChat={handleNewChat}
      />

      {/* ── Chat area ───────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header
          className="flex md:hidden items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "#0d1625" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            ⚡
          </div>
          <span
            className="font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Swift Agent
          </span>
        </header>

        {/* Messages — takes remaining space */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <MessageList
            items={items}
            isStreaming={isStreaming}
            onInterruptDecide={handleInterruptDecide}
          />
        </div>

        {/* Input bar */}
        <div
          className="shrink-0 px-4 pb-4 pt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={handleSend}
              disabled={isStreaming}
              placeholder={
                isStreaming
                  ? "Swift is thinking…"
                  : "Message Swift — ask about your Supabase projects…"
              }
            />
            <p
              className="text-center text-xs mt-2"
              style={{ color: "#334155" }}
            >
              Protected tools require your approval before running.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
