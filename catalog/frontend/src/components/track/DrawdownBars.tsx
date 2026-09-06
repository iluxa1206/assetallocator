"use client";

import { useMemo } from "react";
import {
  ComposedChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/format";
import type { TrackSeries } from "@/lib/track-data";
import {
  combinedSeries, drawdownOverWindow, maxDrawdownInfo, fmtDateRu, fmtMonthRu, fmtDuration,
} from "@/lib/track-metrics";

type DDRow = { d: string; dd: number | null; peakDate: string };

type TooltipProps = { active?: boolean; payload?: { payload?: DDRow }[] };

function DDTooltip({ active, payload }: TooltipProps) {
  const w = payload?.[0]?.payload;
  if (!active || !w || w.dd == null) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(10,14,28,0.35)]">
      <div className="font-semibold text-muted-foreground mb-1.5">{fmtDateRu(w.d)}</div>
      <div className="space-y-1 tabular-nums">
        <div className="flex items-center gap-3">
          <span className="flex-1 text-foreground font-medium">Просадка</span>
          <span className={cn("font-semibold", w.dd < 0 ? "text-[var(--neg)]" : "text-muted-foreground")}>
            {w.dd < 0 ? fmtPct(w.dd) : "0% (пик)"}
          </span>
        </div>
        {w.dd < 0 && (
          <div className="text-muted-foreground">от пика {fmtDateRu(w.peakDate)}</div>
        )}
      </div>
    </div>
  );
}

interface Props {
  series: TrackSeries;
  /** Видимое окно периода — те же точки, что в TrackChart: оси совпадают (syncId). */
  window: TrackSeries["points"];
}

/** Столбики просадки: снижение от достигнутого максимума до значения на дату столбца.
 * Ось X повторяет основной график (syncId="track") — просадка читается под точкой трека. */
export function DrawdownBars({ series, window: win }: Props) {
  const { data, minDD, deepest } = useMemo(() => {
    const data = drawdownOverWindow(win);
    let minDD = 0;
    let deepest = "";
    for (const r of data) {
      if (r.dd != null && r.dd < minDD) {
        minDD = r.dd;
        deepest = r.d;
      }
    }
    return { data, minDD, deepest };
  }, [win]);

  const info = useMemo(() => maxDrawdownInfo(combinedSeries(win)), [win]);
  const pad = Math.max(Math.abs(minDD) * 0.08, 0.005);

  return (
    <div className="glossy rounded-2xl p-5">
      <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold">Просадка от пика</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Каждый столбец — снижение от достигнутого максимума до значения на эту дату
          </p>
        </div>
        {info && (
          <div className="text-xs text-muted-foreground tabular-nums text-right">
            Макс. просадка:{" "}
            <span className="font-semibold text-[var(--neg)]">{fmtPct(info.depth)}</span>
            <div className="mt-0.5">
              {fmtMonthRu(info.peakDate)} → {fmtMonthRu(info.troughDate)}
              {info.recoveryDays != null
                ? ` · восстановление ${fmtDuration(info.recoveryDays)}`
                : " · не восстановлена"}
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} syncId="track" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="d"
            tickFormatter={fmtMonthRu}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            minTickGap={48}
          />
          <YAxis
            domain={[minDD - pad, 0]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tickLine={false}
            axisLine={false}
            width={44}
            tickCount={5}
          />
          <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }} content={<DDTooltip />} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Bar dataKey="dd" name="Просадка" maxBarSize={14} radius={[0, 0, 2, 2]}>
            {data.map((r) => (
              <Cell
                key={r.d}
                fill="var(--neg)"
                fillOpacity={r.d === deepest ? 0.95 : 0.6}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-[11px] text-muted-foreground-2 mt-2">
        Ось X совпадает с графиком выше: пик пересчитывается на старте выбранного периода.
      </p>
    </div>
  );
}
