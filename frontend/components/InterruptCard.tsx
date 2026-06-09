"use client";

import type { InterruptDecision, InterruptPayload } from "@/lib/types";
import { useState, useRef, useEffect } from "react";

interface Props {
  payload: InterruptPayload;
  onDecide: (decision: InterruptDecision) => void;
  disabled?: boolean;
}

type Tab = "approve" | "edit" | "feedback" | "reject";

export default function InterruptCard({ payload, onDecide, disabled }: Props) {
  const [tab, setTab] = useState<Tab>("approve");
  const [editedArgs, setEditedArgs] = useState(
    JSON.stringify(payload.args ?? payload.tool_call?.args ?? {}, null, 2)
  );
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [jsonError, setJsonError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (tab === "edit") textareaRef.current?.focus();
  }, [tab]);

  function handleSubmit() {
    if (tab === "approve") {
      onDecide({ action: "approve" });
    } else if (tab === "edit") {
      try {
        const parsed = JSON.parse(editedArgs);
        onDecide({ action: "update", args: parsed });
      } catch {
        setJsonError("Invalid JSON — please fix before submitting.");
        return;
      }
    } else if (tab === "feedback") {
      onDecide({ action: "feedback", message: feedbackMsg });
    } else if (tab === "reject") {
      onDecide({ action: "reject" });
    }
  }

  const toolName = payload.tool_call?.name ?? "unknown tool";
  const args = payload.args ?? payload.tool_call?.args ?? {};
  const argsStr = JSON.stringify(args, null, 2);

  const tabs: { id: Tab; label: string; icon: string; color: string }[] = [
    { id: "approve", label: "Approve", icon: "✅", color: "var(--green)" },
    { id: "edit", label: "Edit Args", icon: "✏️", color: "var(--amber)" },
    { id: "feedback", label: "Feedback", icon: "💬", color: "var(--accent-from)" },
    { id: "reject", label: "Reject", icon: "❌", color: "var(--red)" },
  ];

  const submitColors: Record<Tab, string> = {
    approve: "bg-green-600 hover:bg-green-500",
    edit: "bg-amber-600 hover:bg-amber-500",
    feedback: "bg-indigo-600 hover:bg-indigo-500",
    reject: "bg-red-700 hover:bg-red-600",
  };

  const submitLabels: Record<Tab, string> = {
    approve: "✅ Approve & Run",
    edit: "✏️ Update & Run",
    feedback: "💬 Send Feedback",
    reject: "❌ Reject Tool Call",
  };

  return (
    <div
      className="animate-in rounded-2xl overflow-hidden"
      style={{
        border: "1px solid rgba(239,68,68,0.3)",
        background:
          "linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(13,22,37,0.95) 40%)",
        boxShadow: "0 4px 32px rgba(239,68,68,0.12)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid rgba(239,68,68,0.15)" }}
      >
        <span className="text-xl mt-0.5">🛡️</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: "var(--red)" }}>
            Your Approval is Required
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {payload.message ?? `Agent wants to call`}{" "}
            <code
              className="mono px-1.5 py-0.5 rounded text-xs"
              style={{
                background: "rgba(245,158,11,0.15)",
                color: "var(--amber)",
              }}
            >
              {toolName}
            </code>
          </p>
        </div>
      </div>

      {/* Args preview */}
      <div className="px-5 py-3">
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
          TOOL ARGUMENTS
        </p>
        <pre
          className="text-xs rounded-lg p-3 overflow-x-auto"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid var(--border)",
            color: "#94a3b8",
            maxHeight: "160px",
          }}
        >
          {argsStr}
        </pre>
      </div>

      {/* Action tabs */}
      <div
        className="flex gap-1 px-5 pb-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setJsonError(""); }}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
            style={{
              background: tab === t.id ? `${t.color}22` : "transparent",
              border: `1px solid ${tab === t.id ? t.color + "66" : "transparent"}`,
              color: tab === t.id ? t.color : "var(--text-muted)",
            }}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-5 py-4">
        {tab === "approve" && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            The tool will run with the arguments shown above. Click{" "}
            <strong className="text-green-400">Approve & Run</strong> to proceed.
          </p>
        )}

        {tab === "edit" && (
          <div>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Edit the JSON args below, then submit.
            </p>
            <textarea
              ref={textareaRef}
              value={editedArgs}
              onChange={(e) => { setEditedArgs(e.target.value); setJsonError(""); }}
              disabled={disabled}
              spellCheck={false}
              rows={8}
              className="w-full rounded-lg p-3 text-xs mono resize-none outline-none transition-colors"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${jsonError ? "var(--red)" : "var(--border)"}`,
                color: "#e2e8f0",
              }}
            />
            {jsonError && (
              <p className="text-xs mt-1" style={{ color: "var(--red)" }}>
                {jsonError}
              </p>
            )}
          </div>
        )}

        {tab === "feedback" && (
          <div>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Tell the agent why to skip this and what to do instead.
            </p>
            <textarea
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
              disabled={disabled}
              placeholder="e.g. Use project name 'production' instead..."
              rows={4}
              className="w-full rounded-lg p-3 text-sm resize-none outline-none transition-colors placeholder:opacity-40"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        )}

        {tab === "reject" && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            The tool call will be cancelled. The agent will be told to ask you
            how to proceed.
          </p>
        )}
      </div>

      {/* Submit */}
      <div
        className="flex justify-end px-5 pb-5"
      >
        <button
          onClick={handleSubmit}
          disabled={disabled || (tab === "feedback" && !feedbackMsg.trim())}
          className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${submitColors[tab]}`}
        >
          {submitLabels[tab]}
        </button>
      </div>
    </div>
  );
}
