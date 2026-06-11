"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AIItem,
  ChatItem,
  FileUploadItem,
  InterruptDecision,
  ThreadMeta,
} from "@/lib/types";
import { streamRun, fetchThreadHistory } from "@/lib/langgraph";
import Sidebar from "./Sidebar";
import MessageList from "./MessageList";
import { MorphPanel } from "./ui/ai-input";

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
  const [loadingThread, setLoadingThread] = useState(false);

  // Always-current ref so closures inside useCallback can read latest threadItems
  // without needing it as a dep (which would cause runStream to recreate constantly).
  const threadItemsRef = useRef(threadItems);
  useEffect(() => { threadItemsRef.current = threadItems; }, [threadItems]);

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

      // Collect IDs of tool_result items already in the UI so we don't re-emit them
      // when the `values` event fires with the full historical thread state.
      // Use the ref so we always read the CURRENT items, not a stale closure snapshot.
      const existingItems = opts.threadId ? (threadItemsRef.current[opts.threadId] ?? []) : [];
      const knownToolResultIds = new Set(
        existingItems
          .filter((i) => i.kind === "tool_result")
          .map((i) => i.id)
      );

      try {
        for await (const event of streamRun({
          threadId: opts.threadId,
          input: opts.input,
          command: opts.command,
          knownToolResultIds,
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
            // Use upsertItem for all kinds so duplicate IDs from the stream
            // are updated in place rather than appended again.
            mutate(tid, (prev) => upsertItem(prev, event));
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

  // ── Handle file upload ────────────────────────────────────────
  const handleFileUpload = useCallback(
    async (file: File) => {
      // Ensure we have a thread first
      let tid = activeThreadId;
      if (!tid) {
        // Create a thread via the chat endpoint with an empty input to get a thread_id
        // We'll create it inline here
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: { messages: [] } }),
        });
        tid = res.headers.get("X-Thread-Id");
        if (tid) {
          setActiveThreadId(tid);
          registerThread(tid, `${file.name} analysis`);
        }
      }

      if (!tid) throw new Error("Could not create thread");

      // Upload the file to the backend
      const form = new FormData();
      form.append("file", file);
      form.append("thread_id", tid);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Upload failed: ${res.status}`);
      }

      const data = await res.json() as {
        table_name: string;
        columns: { name: string; dtype: string }[];
        row_count: number;
        preview: Record<string, unknown>[];
      };

      // Add the file upload chat bubble
      const fileItem: FileUploadItem = {
        kind: "file_upload",
        id: crypto.randomUUID(),
        filename: file.name,
        tableName: data.table_name,
        rowCount: data.row_count,
        columns: data.columns,
        preview: data.preview,
      };
      mutate(tid, (prev) => [...prev, fileItem]);

      // Auto-send context message to the agent
      const colList = data.columns.map((c) => `${c.name} (${c.dtype})`).join(", ");
      const agentMessage = `I've uploaded a file called "${file.name}". It has been loaded into a Postgres table named "${data.table_name}". It has ${data.row_count.toLocaleString()} rows and ${data.columns.length} columns: ${colList}. Please analyze this data and suggest what we can explore.`;

      await runStream({
        threadId: tid,
        input: { messages: [{ role: "human", content: agentMessage }] },
      });
    },
    [activeThreadId, mutate, registerThread, runStream]
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
    async (tid: string) => {
      setActiveThreadId(tid);
      // If we already have messages cached, no need to fetch
      if (threadItems[tid]?.length) return;
      setLoadingThread(true);
      try {
        const history = await fetchThreadHistory(tid);
        if (history.length > 0) {
          setThreadItems((prev) => ({ ...prev, [tid]: history }));
        }
      } finally {
        setLoadingThread(false);
      }
    },
    [threadItems]
  );

  const handleDeleteThread = useCallback((tid: string) => {
    setThreads((prev) => {
      const next = prev.filter((t) => t.threadId !== tid);
      saveThreads(next);
      return next;
    });
    setThreadItems((prev) => {
      const copy = { ...prev };
      delete copy[tid];
      return copy;
    });
    setActiveThreadId((prev) => (prev === tid ? null : prev));
  }, []);

  return (
    <div
      className="flex"
      style={{ height: "100dvh", background: "#000000" }}
    >
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelect={handleSelectThread}
        onNewChat={handleNewChat}
        onDelete={handleDeleteThread}
      />

      {/* ── Chat area ───────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header
          className="flex md:hidden items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#070707" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: "linear-gradient(135deg, #ffffff, #888888)" }}
          >
            ⚡
          </div>
          <span
            className="font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, #ffffff, #888888)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            Swift Agent
          </span>
        </header>

        {/* Messages — takes remaining space */}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          {loadingThread && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "transparent" }}
                />
                <p className="text-sm" style={{ color: "#444444" }}>Loading conversation…</p>
              </div>
            </div>
          )}
          <MessageList
            items={items}
            isStreaming={isStreaming}
            onInterruptDecide={handleInterruptDecide}
            onSuggestionClick={handleSend}
            onUploadClick={() => {
              // Trigger the file input in MorphPanel by simulating a click on the attach button
              document.getElementById("attach-file-btn")?.click();
            }}
          />
        </div>

        {/* Input bar */}
        <div
          className="shrink-0 px-4 pb-4 pt-3"
        // style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="max-w-3xl mx-auto flex justify-center">
            <MorphPanel
              onSend={handleSend}
              onFileUpload={handleFileUpload}
              disabled={isStreaming}
              placeholder={
                isStreaming
                  ? "Swift is thinking…"
                  : "Message Swift — ask about your data or Supabase projects…"
              }
            />

          </div>
        </div>
      </div>
    </div>
  );
}
