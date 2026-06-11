"use client";

import type { FileUploadItem as FileUploadItemType } from "@/lib/types";

interface Props {
  item: FileUploadItemType;
}

const DTYPE_COLORS: Record<string, string> = {
  INTEGER: "rgba(96, 165, 250, 0.15)",
  FLOAT: "rgba(52, 211, 153, 0.15)",
  TEXT: "rgba(167, 139, 250, 0.15)",
  TIMESTAMP: "rgba(251, 191, 36, 0.15)",
  BOOLEAN: "rgba(248, 113, 113, 0.15)",
};

const DTYPE_TEXT: Record<string, string> = {
  INTEGER: "#60a5fa",
  FLOAT: "#34d399",
  TEXT: "#a78bfa",
  TIMESTAMP: "#fbbf24",
  BOOLEAN: "#f87171",
};

export default function FileUploadItem({ item }: Props) {
  const { filename, tableName, rowCount, columns, preview } = item;

  return (
    <div className="flex justify-start w-full">
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* File icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04))",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            📊
          </div>

          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "#e5e5e5", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {filename}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#555" }}>
              {rowCount.toLocaleString()} rows · {columns.length} columns
            </p>
          </div>

          {/* Ready badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
            style={{
              background: "rgba(52, 211, 153, 0.1)",
              border: "1px solid rgba(52, 211, 153, 0.25)",
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#34d399" }}
            />
            <span className="text-xs font-medium" style={{ color: "#34d399" }}>
              Table ready
            </span>
          </div>
        </div>

        {/* Column chips */}
        <div className="px-4 py-3 flex flex-wrap gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {columns.map((col) => (
            <span
              key={col.name}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs"
              style={{
                background: DTYPE_COLORS[col.dtype] ?? "rgba(255,255,255,0.05)",
                border: `1px solid ${DTYPE_TEXT[col.dtype] ?? "rgba(255,255,255,0.1)"}30`,
              }}
            >
              <span style={{ color: DTYPE_TEXT[col.dtype] ?? "#999", fontFamily: "monospace", fontSize: "10px" }}>
                {col.dtype.slice(0, 3)}
              </span>
              <span style={{ color: "#bbb" }}>{col.name}</span>
            </span>
          ))}
        </div>

        {/* Table name */}
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-xs" style={{ color: "#444" }}>Table:</span>
          <code
            className="text-xs px-2 py-0.5 rounded-md"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#a78bfa",
              fontFamily: "monospace",
            }}
          >
            {tableName}
          </code>
        </div>

        {/* Mini data preview */}
        {preview.length > 0 && (
          <div
            className="px-4 pb-3 overflow-x-auto"
            style={{ scrollbarWidth: "thin" }}
          >
            <table className="text-xs w-full min-w-max">
              <thead>
                <tr>
                  {columns.slice(0, 6).map((col) => (
                    <th
                      key={col.name}
                      className="text-left pb-1.5 pr-4 font-medium"
                      style={{ color: "#555", fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {col.name}
                    </th>
                  ))}
                  {columns.length > 6 && (
                    <th className="text-left pb-1.5 pr-4 font-medium" style={{ color: "#444" }}>
                      +{columns.length - 6} more
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 3).map((row, i) => (
                  <tr key={i}>
                    {columns.slice(0, 6).map((col) => (
                      <td
                        key={col.name}
                        className="pr-4 pb-1 truncate max-w-[120px]"
                        style={{ color: "#666" }}
                      >
                        {String(row[col.name] ?? "")}
                      </td>
                    ))}
                    {columns.length > 6 && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
