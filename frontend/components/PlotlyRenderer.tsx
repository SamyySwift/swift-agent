"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useRef, useState, useMemo } from "react";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "transparent" }} />
  </div>
) }) as React.ComponentType<PlotParams>;

type PlotConfig = {
  data: Plotly.Data[];
  layout: Partial<Plotly.Layout>;
} | null;

function parsePlotlyContent(dataStr: string): PlotConfig {
  try {
    const parsed = JSON.parse(dataStr);
    // Reject if this looks like a python_code wrapper rather than a Plotly figure
    if (parsed.python_code || !parsed.data) {
      console.error("[PlotlyRenderer] Content is not a Plotly figure JSON:", Object.keys(parsed));
      return null;
    }
    return {
      data: parsed.data,
      layout: {
        ...parsed.layout,
        autosize: true,
        margin: { t: 50, r: 20, l: 50, b: 80 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { ...(parsed.layout?.font || {}), color: "white" },
        xaxis: { ...(parsed.layout?.xaxis || {}), color: "white", gridcolor: "rgba(255,255,255,0.1)", zerolinecolor: "rgba(255,255,255,0.2)" },
        yaxis: { ...(parsed.layout?.yaxis || {}), color: "white", gridcolor: "rgba(255,255,255,0.1)", zerolinecolor: "rgba(255,255,255,0.2)" },
        legend: { ...(parsed.layout?.legend || {}), font: { color: "white" } },
      },
    };
  } catch (e) {
    console.error("[PlotlyRenderer] Failed to parse Plotly JSON:", e);
    return null;
  }
}

export default function PlotlyRenderer({ dataStr }: { dataStr: string }) {
  const plotConfig = useMemo(() => parsePlotlyContent(dataStr), [dataStr]);
  const containerRef = useRef<HTMLDivElement>(null);
  // revision counter — incrementing forces react-plotly.js to re-layout after the
  // container is actually sized (fixes the "0×0 on first paint" mobile bug).
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      setRevision((r) => r + 1);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!plotConfig) {
    return (
      <div className="text-red-500 bg-red-500/10 p-4 rounded-xl font-mono text-xs whitespace-pre-wrap">
        ⚠️ Failed to render chart: the model returned invalid or incomplete plot data.
        <br /><br />
        <strong>Received (first 300 chars):</strong>
        <br />
        {typeof dataStr === "string" ? dataStr.slice(0, 300) : JSON.stringify(dataStr)}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full my-4 bg-white/5 rounded-xl border border-white/10 p-2 overflow-hidden"
      style={{ height: "clamp(280px, 45vw, 520px)" }}
    >
      <Plot
        data={plotConfig.data}
        layout={{ ...plotConfig.layout, datarevision: revision }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler={true}
      />
    </div>
  );
}
