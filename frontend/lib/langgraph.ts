/**
 * Client-side SSE stream parser for the LangGraph chat proxy.
 *
 * Usage:
 *   for await (const event of streamRun({ threadId, input })) {
 *     // handle event
 *   }
 */

import type {
  ChatItem,
  ContentBlock,
  InterruptPayload,
  RawMessage,
  ToolCall,
} from "./types";

interface StreamRunOptions {
  threadId?: string;
  input?: { messages: { role: string; content: string }[] };
  command?: { resume: unknown };
  onThreadId?: (id: string) => void;
  /** IDs of tool_result items already rendered in the UI — skip re-emitting them */
  knownToolResultIds?: Set<string>;
}

function parseContent(content: string | ContentBlock[] | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

// ── Fetch thread history from LangGraph state ───────────────────

export async function fetchThreadHistory(threadId: string): Promise<ChatItem[]> {
  const res = await fetch(`/api/threads/${threadId}/state`);
  if (!res.ok) return [];

  let state: Record<string, unknown>;
  try {
    state = await res.json();
  } catch {
    return [];
  }

  const messages = state["values"] as Record<string, unknown> | undefined;
  const rawMessages = (messages?.["messages"] ?? state["messages"]) as RawMessage[] | undefined;
  if (!Array.isArray(rawMessages)) return [];

  const items: ChatItem[] = [];

  for (const msg of rawMessages) {
    const role = msg.type ?? msg.role ?? "";
    const content = parseContent(msg.content);

    if (role === "human") {
      items.push({
        kind: "human",
        id: msg.id ?? crypto.randomUUID(),
        text: content,
      });
    } else if (role === "ai") {
      // Push any tool calls first
      for (const tc of (msg.tool_calls ?? []) as ToolCall[]) {
        if (tc.id && tc.name) {
          items.push({
            kind: "tool_call",
            id: tc.id,
            name: tc.name,
            args: tc.args ?? {},
          });
        }
      }
      // Only push AI text bubble if there's actual text
      if (content) {
        items.push({
          kind: "ai",
          id: msg.id ?? crypto.randomUUID(),
          text: content,
          streaming: false,
        });
      }
    } else if (role === "tool") {
      const raw =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      items.push({
        kind: "tool_result",
        id: msg.id ?? crypto.randomUUID(),
        name: msg.name ?? "tool",
        content: raw,
        isError: msg.status === "error",
      });
    }
  }

  return items;
}

// ── The main async generator ────────────────────────────────────

export async function* streamRun(
  opts: StreamRunOptions
): AsyncGenerator<ChatItem> {
  const { threadId, input, command, onThreadId, knownToolResultIds } = opts;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, input, command }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "Network error");
    yield {
      kind: "error",
      id: crypto.randomUUID(),
      message: text,
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Track streaming AI message id so we can update in place
  let currentAiId: string | null = null;
  let accumulatedText = "";
  const seenToolCallIds = new Set<string>();
  // Track tool result message IDs we've already emitted (to avoid duplicates)
  // Pre-seed with any IDs already rendered in the UI from previous runs.
  const seenToolResultIds = new Set<string>(knownToolResultIds ?? []);

  // Parse SSE lines
  function* parseSSE(chunk: string): Generator<{ event: string; data: string }> {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let event = "";
    let data = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        event = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        data += line.slice(6) + "\n";
      } else if (line.trim() === "") {
        if (event && data) {
          yield { event, data: data.trimEnd() };
        }
        event = "";
        data = "";
      }
    }
  }

  try {
    const processEvent = (event: string, data: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        return null;
      }

      if (event === "thread_id") {
        try {
          const parsedThread = parsed as { thread_id: string };
          onThreadId?.(parsedThread.thread_id);
        } catch {}
        return null;
      }

      if (event === "messages/partial") {
        const partials = Array.isArray(parsed)
          ? parsed
          : Object.values(parsed as Record<string, RawMessage>);

        const results: ChatItem[] = [];
        for (const msg of partials) {
          const role = msg.type ?? msg.role ?? "";
          const content = parseContent(msg.content);

          if (role === "ai") {
            // If we are already tracking an AI message but the incoming msg has a DIFFERENT id,
            // it means the agent is generating a NEW message (e.g. after a tool call).
            if (currentAiId && msg.id && currentAiId !== msg.id) {
              if (accumulatedText) {
                results.push({
                  kind: "ai",
                  id: currentAiId,
                  text: accumulatedText,
                  streaming: false,
                });
              }
              currentAiId = msg.id;
              accumulatedText = "";
            } else if (!currentAiId) {
              currentAiId = msg.id ?? crypto.randomUUID();
              accumulatedText = "";
            }

            if (content && content.length > accumulatedText.length) {
              accumulatedText = content;
              results.push({
                kind: "ai",
                id: currentAiId!,
                text: accumulatedText,
                streaming: true,
              });
            }

            for (const tc of (msg.tool_calls ?? []) as ToolCall[]) {
              if (tc.id && tc.name) {
                seenToolCallIds.add(tc.id);
                results.push({
                  kind: "tool_call",
                  id: tc.id,
                  name: tc.name,
                  args: tc.args ?? {},
                });
              }
            }
          }

          if (role === "tool") {
            if (currentAiId) {
              results.push({
                kind: "ai",
                id: currentAiId,
                text: accumulatedText,
                streaming: false,
              });
              currentAiId = null;
              accumulatedText = "";
            }

            // Skip generate_visualization tool results from partial events —
            // the full JSON will be reliably emitted from the `values` event.
            // For other tools, emit immediately as usual.
            const toolName = msg.name ?? "tool";
            if (toolName !== "generate_visualization") {
              const rid = msg.id ?? "";
              if (!rid || !seenToolResultIds.has(rid)) {
                if (rid) seenToolResultIds.add(rid);
                const raw =
                  typeof msg.content === "string"
                    ? msg.content
                    : JSON.stringify(msg.content);
                results.push({
                  kind: "tool_result",
                  id: rid || crypto.randomUUID(),
                  name: toolName,
                  content: raw,
                  isError: msg.status === "error",
                });
              }
            }
          }
        }
        return results;
      }

      if (event === "values") {
        const state = parsed as Record<string, unknown>;
        const results: ChatItem[] = [];

        const interrupts = state["__interrupt__"];
        if (Array.isArray(interrupts) && interrupts.length > 0) {
          if (currentAiId) {
            if (accumulatedText) {
              results.push({
                kind: "ai",
                id: currentAiId,
                text: accumulatedText,
                streaming: false,
              });
            }
            currentAiId = null;
            accumulatedText = "";
          }

          const raw = interrupts[0] as { value?: InterruptPayload };
          const payload = raw.value ?? (raw as unknown as InterruptPayload);
          results.push({
            kind: "interrupt",
            id: crypto.randomUUID(),
            payload,
          });
        }

        const messages = state["messages"] as RawMessage[] | undefined;
        if (Array.isArray(messages)) {
          // Emit any generate_visualization tool results that haven't been seen yet
          // We do this from the values event so the content is guaranteed to be complete.
          for (const msg of messages) {
            const role = msg.type ?? msg.role ?? "";
            if (role === "tool" && (msg.name ?? "") === "generate_visualization") {
              const rid = msg.id ?? "";
              if (!seenToolResultIds.has(rid) || rid === "") {
                if (rid) seenToolResultIds.add(rid);
                const raw =
                  typeof msg.content === "string"
                    ? msg.content
                    : JSON.stringify(msg.content);
                results.push({
                  kind: "tool_result",
                  id: rid || crypto.randomUUID(),
                  name: "generate_visualization",
                  content: raw,
                  isError: msg.status === "error",
                });
              }
            }
          }
        }
        return results;
      }

      if (event === "error") {
        const errData =
          typeof parsed === "object" && parsed !== null
            ? (parsed as Record<string, unknown>)
            : {};
        const message =
          (errData.message as string) ?? JSON.stringify(parsed);
        return [{
          kind: "error" as const,
          id: crypto.randomUUID(),
          message,
        }];
      }

      return null;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      for (const { event, data } of parseSSE(chunk)) {
        const results = processEvent(event, data);
        if (results) {
          for (const item of results) yield item;
        }
      }
    }

    // Final flush of buffer
    if (buffer.trim()) {
      for (const { event, data } of parseSSE("\n\n")) {
        const results = processEvent(event, data);
        if (results) {
          for (const item of results) yield item;
        }
      }
    }
  } finally {
    // Finalise any open AI stream
    if (currentAiId) {
      if (accumulatedText) {
        yield {
          kind: "ai",
          id: currentAiId,
          text: accumulatedText,
          streaming: false,
        };
      }
    }
  }
}
