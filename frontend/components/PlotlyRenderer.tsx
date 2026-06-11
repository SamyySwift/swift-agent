"use client";

import dynamic from "next/dynamic";
import React, { useMemo } from "react";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as React.ComponentType<PlotParams>;

export default function PlotlyRenderer({ dataStr }: { dataStr: string }) {
  const plotConfig = useMemo(() => {
    try {
      const parsed = JSON.parse(dataStr);
      return {
        data: parsed.data || [],
        layout: {
          ...parsed.layout,
          autosize: true,
          margin: { t: 50, r: 30, l: 60, b: 120 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: "var(--text)" },
        },
      };
    } catch (e) {
      console.error("Failed to parse Plotly JSON:", e);
      return null;
    }
  }, [dataStr]);

  if (!plotConfig) {
    return (
      <div className="text-red-500 bg-red-500/10 p-4 rounded-xl font-mono text-xs whitespace-pre-wrap">
        Failed to render plot: invalid JSON.
        <br />
        <br />
        <strong>Received string (first 500 chars):</strong>
        <br />
        {typeof dataStr === "string" ? dataStr.slice(0, 500) : JSON.stringify(dataStr)}
      </div>
    );
  }

  return (
    <div className="w-full h-[520px] my-4 bg-white/5 rounded-xl border border-white/10 p-2 overflow-hidden">
      <Plot
        data={plotConfig.data}
        layout={plotConfig.layout}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler={true}
      />
    </div>
  );
}
