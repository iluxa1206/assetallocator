"use client";

import { useMemo } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import type { CompetitorRow } from "@/lib/api";

const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

/** ISO "YYYY-MM-DD" → epoch ms (UTC midnight) for time-axis positioning. */
function tsOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fmtTs(t: number): string {
  const dt = new Date(t);
  return `${MONTHS_SHORT[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

function fmtTsFull(t: number): string {
  const dt = new Date(t);
  return `${String(dt.getUTCDate()).padStart(2, "0")}.${String(dt.getUTCMonth() + 1).padStart(2, "0")}.${dt.getUTCFullYear()}`;
}

// Distinct-enough palette for overlaid lines. Own/benchmark get special treatment.
const PALETTE = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

interface Props {
  rows: CompetitorRow[];      // selected rows to overlay
  height?: number;
}

/** Overlays several normalized (base=100) fund series on one shared date axis. */
export function CompetitorOverlayChart({ rows, height = 360 }: Props) {
  const { data, series, yDomain } = useMemo(() => {
    const usable = rows.filter((r) => Array.isArray(r.points) && r.points.length >= 2 && r.dates);
    // Merge every point onto ONE row per timestamp. A numeric time axis positions each
    // point by its real date, so mixing monthly (own funds) and daily (competitors)
    // series stays aligned — connectNulls bridges the gaps.
    const byTs = new Map<number, Record<string, number>>();
    for (const r of usable) {
      r.dates!.forEach((d, i) => {
        const t = tsOf(d);
        const row = byTs.get(t) ?? { t };
        row[r.key] = +r.points[i].toFixed(2);
        byTs.set(t, row);
      });
    }
    const data = Array.from(byTs.values()).sort((a, b) => a.t - b.t);

    const series = usable.map((r, i) => ({
      key: r.key,
      name: r.short_name || r.name,
      color: r.kind === "benchmark" ? "var(--muted-foreground)" : PALETTE[i % PALETTE.length],
      dashed: r.kind === "benchmark",
      own: r.kind === "own",
    }));

    // Fit the Y axis to the actual values (+ the 100 baseline) with a little padding,
    // instead of recharts' default 0-anchored domain that wastes most of the height.
    const vals: number[] = [100];
    for (const row of data) for (const s of usable) {
      const v = row[s.key];
      if (typeof v === "number") vals.push(v);
    }
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const pad = Math.max((maxV - minV) * 0.08, 0.5);
    const yDomain: [number, number] = [
      Math.floor((minV - pad) / 2) * 2,
      Math.ceil((maxV + pad) / 2) * 2,
    ];

    return { data, series, yDomain };
  }, [rows]);

  if (series.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground-2">
        выберите фонды для сравнения
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={fmtTs}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          minTickGap={56}
        />
        <YAxis
          domain={yDomain}
          allowDataOverflow
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={40}
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
          labelFormatter={(t) => fmtTsFull(typeof t === "number" ? t : Number(t))}
          formatter={(v, name) => {
            const num = typeof v === "number" ? v : Number(v);
            const pct = `${num >= 100 ? "+" : "−"}${Math.abs(num - 100).toFixed(1).replace(".", ",")}%`;
            return [`${num.toFixed(1).replace(".", ",")}  (${pct})`, name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="plainline" />
        <ReferenceLine y={100} stroke="var(--border)" strokeDasharray="4 4" />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={s.own ? 2.6 : s.dashed ? 1.4 : 1.8}
            strokeDasharray={s.dashed ? "5 3" : undefined}
            dot={false}
            connectNulls
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
