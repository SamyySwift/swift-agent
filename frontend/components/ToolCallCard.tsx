"use client";

import { useState } from "react";
import type { ToolCallItem } from "@/lib/types";

type Props = Omit<ToolCallItem, "kind">;

export default function ToolCallCard({ name, args }: Props) {
  const [open, setOpen] = useState(false);
  const hasArgs = Object.keys(args ?? {}).length > 0;

  return (
    <div
      className="rounded-xl overflow-hidden text-xs animate-in"
      style={{
        background: "var(--amber-dim)",
        border: "1px solid rgba(245,158,11,0.2)",
        padding: "2px",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors hover:bg-white/5 rounded-lg"
        aria-expanded={open}
      >
        <span className="text-sm">⚙️</span>
        <span className="font-semibold mono" style={{ color: "var(--amber)" }}>
          {name}
        </span>
        <span style={{ color: "var(--text-muted)" }} className="ml-auto">
          {!hasArgs
            ? "(no args)"
            : open
            ? "▲ hide"
            : "▼ show args"}
        </span>
      </button>

      {open && hasArgs && (
        <pre
          className="px-3 py-3 overflow-x-auto"
          style={{ color: "#94a3b8", borderTop: "1px solid rgba(245,158,11,0.12)" }}
        >
          {JSON.stringify(args, null, 2)}
        </pre>
      )}
    </div>
  );
}
