"use client";

import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, ReferenceArea, Customized,
} from "recharts";

const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function fmtDate(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

/** Largest peak-to-trough decline; returns the bounding indices for shading. */
function maxDrawdown(pts: number[]): { dd: number; peakIdx: number; troughIdx: number } {
  let curPeak = pts[0] ?? 0, curPeakIdx = 0;
  let dd = 0, peakIdx = 0, troughIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i] > curPeak) { curPeak = pts[i]; curPeakIdx = i; }
    const d = curPeak > 0 ? (pts[i] - curPeak) / curPeak : 0;
    if (d < dd) { dd = d; peakIdx = curPeakIdx; troughIdx = i; }
  }
  return { dd, peakIdx, troughIdx };
}

type ChartInternals = {
  yAxisMap?: Record<string, { scale?: (v: number) => number }>;
  offset?: { left: number; top: number; width: number; height: number };
};

interface Props {
  dates: string[];
  points: number[];
  benchPoints?: number[] | null;
  benchLabel?: string;
  tone?: "up" | "down" | "neutral";
  height?: number;
}

export function PerfChart({ dates, points, benchPoints, benchLabel, tone = "neutral", height = 300 }: Props) {
  if (!points || points.length < 2 || !dates || dates.length !== points.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground-2">
        нет данных для графика
      </div>
    );
  }

  const hasBench = Array.isArray(benchPoints) && benchPoints.length === points.length;
  const data = dates.map((d, i) => ({
    date: fmtDate(d),
    portfolio: +points[i].toFixed(2),
    benchmark: hasBench ? +benchPoints![i].toFixed(2) : null,
  }));

  const lineColor =
    tone === "up" ? "var(--pos)" : tone === "down" ? "var(--neg)" : "var(--primary)";

  const all = hasBench ? [...points, ...benchPoints!] : points;
  const minV = Math.min(...all, 100);
  const maxV = Math.max(...all, 100);
  const pad = Math.max((maxV - minV) * 0.08, 1);
  const yDomain: [number, number] = [
    Math.floor((minV - pad) / 5) * 5,
    Math.ceil((maxV + pad) / 5) * 5,
  ];

  const dd = maxDrawdown(points);
  const showDD = dd.dd < -0.02 && dd.troughIdx > dd.peakIdx;

  const gradId = "perfGrad";

  const EndLabels = ({ chart }: { chart: ChartInternals }) => {
    const yMap = chart.yAxisMap, offset = chart.offset;
    if (!yMap || !offset) return null;
    const yScale = yMap[Object.keys(yMap)[0]]?.scale;
    if (typeof yScale !== "function") return null;
    const rightX = offset.left + offset.width;
    const series = [
      { val: points[points.length - 1], color: lineColor },
      ...(hasBench ? [{ val: benchPoints![benchPoints!.length - 1], color: "var(--chart-5)" }] : []),
    ];
    const items = series.map((s) => ({ ...s, y: yScale(s.val) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < 14) items[i].y = items[i - 1].y + 14;
    }
    return (
      <g>
        {items.map((it, i) => (
          <g key={i}>
            <circle cx={rightX} cy={yScale(it.val)} r={3} fill={it.color} stroke="var(--card)" strokeWidth={1.5} />
            <text x={rightX + 7} y={it.y} dy={4} fontSize={12} fontWeight={700} fill={it.color}>
              {Math.round(it.val)}
            </text>
          </g>
        ))}
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 46, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          interval="preserveStartEnd"
          minTickGap={56}
        />
        <YAxis
          domain={yDomain}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={36}
          tickCount={6}
        />
        <Tooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 3" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: 12,
            boxShadow: "0 8px 24px -8px rgba(10,14,28,0.3)",
          }}
          labelStyle={{ color: "var(--muted-foreground)", fontWeight: 600, marginBottom: 4 }}
          formatter={(v, name) => {
            const raw = Array.isArray(v) ? v[0] : v;
            const num = typeof raw === "number" ? raw : Number(raw);
            const label = name === "portfolio" ? "Стратегия" : (benchLabel ?? "Бенчмарк");
            const pct = `${num >= 100 ? "+" : "−"}${Math.abs(num - 100).toFixed(1).replace(".", ",")}%`;
            return [`${num.toFixed(1).replace(".", ",")}  (${pct})`, label];
          }}
        />
        {showDD && (
          <ReferenceArea
            x1={data[dd.peakIdx].date}
            x2={data[dd.troughIdx].date}
            fill="var(--neg)"
            fillOpacity={0.06}
            ifOverflow="extendDomain"
          />
        )}
        <ReferenceLine y={100} stroke="var(--border)" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="portfolio"
          stroke={lineColor}
          strokeWidth={2.2}
          fill={`url(#${gradId})`}
          dot={false}
          connectNulls
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        {hasBench && (
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke="var(--chart-5)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        )}
        <Customized component={(p: unknown) => <EndLabels chart={p as ChartInternals} />} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
