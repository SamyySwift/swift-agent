"use client";

import { useState } from "react";
import type { ToolResultItem } from "@/lib/types";

type Props = Omit<ToolResultItem, "kind">;

function tryPretty(raw: string): { pretty: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(raw);
    return { pretty: JSON.stringify(parsed, null, 2), isJson: true };
  } catch {
    return { pretty: raw, isJson: false };
  }
}

export default function ToolResultCard({ name, content, isError }: Props) {
  const [open, setOpen] = useState(false);
  const { pretty } = tryPretty(content);
  const preview = pretty.length > 120 ? pretty.slice(0, 120) + "…" : pretty;

  const color     = isError ? "var(--red)"   : "var(--green)";
  const dimColor  = isError ? "var(--red-dim)" : "var(--green-dim)";
  const border    = isError
    ? "rgba(239,68,68,0.2)"
    : "rgba(34,197,94,0.2)";
  const icon      = isError ? "❌" : "✅";

  return (
    <div
      className="rounded-xl overflow-hidden text-xs animate-in"
      style={{
        background: dimColor,
        border: `1px solid ${border}`,
        padding: "2px",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors hover:bg-white/5 rounded-lg"
        aria-expanded={open}
      >
        <span className="text-sm">{icon}</span>
        <span className="font-semibold mono" style={{ color }}>
          {name}
        </span>
        {!open && (
          <span
            className="ml-2 truncate max-w-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {preview}
          </span>
        )}
        <span style={{ color: "var(--text-muted)" }} className="ml-auto shrink-0">
          {open ? "▲ hide" : "▼ expand"}
        </span>
      </button>

      {open && (
        <pre
          className="px-3 py-3 overflow-x-auto max-h-64"
          style={{
            color: isError ? "#fca5a5" : "#86efac",
            borderTop: `1px solid ${border}`,
          }}
        >
          {pretty}
        </pre>
      )}
    </div>
  );
}
