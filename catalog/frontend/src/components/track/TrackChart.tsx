"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, ReferenceArea, ReferenceDot, Customized,
} from "recharts";
import { cn } from "@/lib/utils";
import type { TrackSeries } from "@/lib/track-data";
import { combinedSeries, maxDrawdownInfo, fmtDateRu, fmtMonthRu } from "@/lib/track-metrics";

const DU_COLOR = "var(--chart-5)"; // сегмент ДУ — teal
const FUND_COLOR = "var(--primary)"; // сегмент ИПИФ — navy

interface Props {
  series: TrackSeries;
  /** Видимое окно — срез series.points */
  window: TrackSeries["points"];
  anchor: string | null;
  onAnchor: (d: string | null) => void;
}

type ChartInternals = {
  xAxisMap?: Record<string, { scale?: ((v: string) => number) & { bandwidth?: () => number } }>;
  yAxisMap?: Record<string, { scale?: (v: number) => number }>;
  offset?: { left: number; top: number; width: number; height: number };
};

/** Маркер дна просадки + подпись глубины, зажатая внутри плота. */
function DDLabel({
  chart, troughDate, troughVal, pct,
}: { chart: ChartInternals; troughDate: string; troughVal: number; pct: string }) {
  const xMap = chart.xAxisMap, yMap = chart.yAxisMap, offset = chart.offset;
  if (!xMap || !yMap || !offset) return null;
  const xScale = xMap[Object.keys(xMap)[0]]?.scale;
  const yScale = yMap[Object.keys(yMap)[0]]?.scale;
  if (typeof xScale !== "function" || typeof yScale !== "function") return null;

  const bw = typeof xScale.bandwidth === "function" ? xScale.bandwidth() : 0;
  const px = xScale(troughDate) + bw / 2;
  const py = yScale(troughVal);
  const left = offset.left, right = offset.left + offset.width, bottom = offset.top + offset.height;
  const textW = pct.length * 7;

  let ly = py + 16;
  if (ly > bottom - 2) ly = py - 10;

  let tx = px;
  let anchor: "start" | "middle" | "end" = "middle";
  if (px - textW / 2 < left + 2) { tx = left + 4; anchor = "start"; }
  else if (px + textW / 2 > right - 2) { tx = right - 4; anchor = "end"; }

  return (
    <g>
      <circle cx={px} cy={py} r={3.5} fill="var(--neg)" stroke="var(--card)" strokeWidth={1.5} />
      <text x={tx} y={ly} dy={4} fontSize={11} fontWeight={700} fill="var(--neg)" textAnchor={anchor}>
        {pct}
      </text>
    </g>
  );
}

type TooltipEntry = { dataKey?: string | number; value?: number | string; name?: string; color?: string };
type TrackTooltipProps = {
  active?: boolean; payload?: TooltipEntry[]; label?: string;
  duLabel: string; fundLabel: string; anchorVal: number | null;
};

function TrackTooltip({ active, payload, label, duLabel, fundLabel, anchorVal }: TrackTooltipProps) {
  if (!active || !payload || !payload.length || !label) return null;
  const fund = payload.find((p) => p.dataKey === "fund")?.value;
  const du = payload.find((p) => p.dataKey === "du")?.value;
  const v = typeof fund === "number" ? fund : typeof du === "number" ? du : null;
  if (v == null) return null;
  const isFund = typeof fund === "number";
  const fmt = (n: number) => n.toFixed(1).replace(".", ",");
  const fmtPct = (n: number) => (n >= 0 ? "+" : "−") + Math.abs(n * 100).toFixed(1).replace(".", ",") + "%";
  const sinceStart = v / 100 - 1;
  const sinceAnchor = anchorVal != null && anchorVal > 0 ? v / anchorVal - 1 : null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(10,14,28,0.35)]">
      <div className="font-semibold text-muted-foreground mb-1.5">{fmtDateRu(label)}</div>
      <div className="space-y-1 tabular-nums">
        <div className="flex items-center gap-2">
          <span className="h-[3px] w-3 rounded-full shrink-0" style={{ background: isFund ? FUND_COLOR : DU_COLOR }} />
          <span className="text-muted-foreground flex-1 pr-3">{isFund ? fundLabel : duLabel}</span>
          <span className="font-semibold text-foreground">{fmt(v)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 shrink-0" />
          <span className="text-muted-foreground flex-1 pr-3">С начала периода</span>
          <span className={sinceStart >= 0 ? "text-[var(--pos)] font-semibold" : "text-[var(--neg)] font-semibold"}>
            {fmtPct(sinceStart)}
          </span>
        </div>
        {sinceAnchor != null && (
          <div className="flex items-center gap-2">
            <span className="w-3 shrink-0" />
            <span className="text-muted-foreground flex-1 pr-3">От выбранной точки</span>
            <span className={sinceAnchor >= 0 ? "text-[var(--pos)] font-semibold" : "text-[var(--neg)] font-semibold"}>
              {fmtPct(sinceAnchor)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground/60">Клик — выбрать точку отсчёта</div>
    </div>
  );
}

function Chip({ active, onClick, label, swatch }: {
  active: boolean; onClick?: () => void; label: string; swatch: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
        active
          ? "border-border bg-muted/50 text-foreground"
          : "border-transparent text-muted-foreground/55 hover:text-foreground hover:bg-muted/30",
        !onClick && "cursor-default",
      )}
    >
      {swatch}
      <span className={cn(onClick && !active && "line-through decoration-1")}>{label}</span>
    </button>
  );
}

export function TrackChart({ series, window: win, anchor, onAnchor }: Props) {
  const [showDD, setShowDD] = useState(true);
  // Лог-шкала по умолчанию: за 16 лет трек ×23, линейная шкала сплющивает раннюю историю.
  const [logScale, setLogScale] = useState(true);

  const { data, combined, transitionVisible } = useMemo(() => {
    const combinedRaw = combinedSeries(win);
    const base = combinedRaw.length ? combinedRaw[0].v : 1;
    const f = base > 0 ? 100 / base : 1;
    const data = win.map((p) => ({
      d: p.d,
      du: p.du != null ? +(p.du * f).toFixed(2) : null,
      fund: p.fund != null ? +(p.fund * f).toFixed(2) : null,
    }));
    const combined = combinedRaw.map((p) => ({ d: p.d, v: +(p.v * f).toFixed(2) }));
    const transitionVisible = win.some((p) => p.d === series.transitionDate)
      && win[0]?.d !== series.transitionDate;
    return { data, combined, transitionVisible };
  }, [win, series.transitionDate]);

  const vals = combined.map((p) => p.v);
  const minV = vals.length ? Math.min(...vals) : 0;
  const maxV = vals.length ? Math.max(...vals) : 100;
  const yDomain: [number, number] = logScale
    ? [minV * 0.95, maxV * 1.05]
    : [
        Math.max(0, Math.floor((minV - Math.max((maxV - minV) * 0.06, 2)) / 10) * 10),
        Math.ceil((maxV + Math.max((maxV - minV) * 0.06, 2)) / 10) * 10,
      ];

  const dd = useMemo(() => maxDrawdownInfo(combined), [combined]);
  const ddActive = showDD && dd != null && dd.depth < -0.02;
  const ddPct = dd ? `−${Math.abs(dd.depth * 100).toFixed(1).replace(".", ",")}%` : "";
  const ddTroughVal = dd ? combined.find((p) => p.d === dd.troughDate)?.v ?? null : null;

  const anchorVal = anchor ? combined.find((p) => p.d === anchor)?.v ?? null : null;

  const hasDu = data.some((p) => p.du != null);
  const hasFund = data.some((p) => p.fund != null);

  return (
    <div className="glossy rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold">Трек стратегии · индекс, старт периода = 100</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {series.duLabel} → {series.fundLabel} · клик по графику — точка отсчёта
          </p>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap">
          {hasDu && (
            <Chip active label={series.duLabel}
              swatch={<span className="h-[3px] w-4 rounded-full shrink-0" style={{ background: DU_COLOR }} />} />
          )}
          {hasFund && (
            <Chip active label={series.fundLabel}
              swatch={<span className="h-[3px] w-4 rounded-full shrink-0" style={{ background: FUND_COLOR }} />} />
          )}
          <Chip
            active={showDD}
            onClick={() => setShowDD((v) => !v)}
            label="Просадка"
            swatch={<span className="h-3 w-3 rounded-sm shrink-0" style={{ background: "color-mix(in oklab, var(--neg) 22%, transparent)", border: "1px solid color-mix(in oklab, var(--neg) 45%, transparent)" }} />}
          />
          <Chip
            active={logScale}
            onClick={() => setLogScale((v) => !v)}
            label="Лог. шкала"
            swatch={<span className="text-[10px] font-bold leading-none text-muted-foreground">㏒</span>}
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart
          data={data}
          syncId="track"
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          onClick={(st) => {
            const label = (st as { activeLabel?: string } | null)?.activeLabel;
            if (label) onAnchor(anchor === label ? null : label);
          }}
          style={{ cursor: "crosshair" }}
        >
          <defs>
            <linearGradient id="trackDuGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="trackFundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            domain={yDomain}
            scale={logScale ? "log" : "linear"}
            allowDataOverflow={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => String(Math.round(v))}
            tickLine={false}
            axisLine={false}
            width={44}
            tickCount={6}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 3" }}
            content={<TrackTooltip duLabel={series.duLabel} fundLabel={series.fundLabel} anchorVal={anchorVal} />}
          />
          {ddActive && dd && (
            <ReferenceArea
              x1={dd.peakDate}
              x2={dd.troughDate}
              fill="var(--neg)"
              fillOpacity={0.12}
              stroke="var(--neg)"
              strokeOpacity={0.3}
              strokeWidth={1}
              ifOverflow="extendDomain"
            />
          )}
          <ReferenceLine y={100} stroke="var(--border)" strokeDasharray="4 4" />
          {transitionVisible && (
            <ReferenceLine
              x={series.transitionDate}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 4"
              strokeOpacity={0.6}
              label={{
                value: "Трансформация в ИПИФ",
                position: "insideTopLeft",
                fontSize: 10,
                fill: "var(--muted-foreground)",
                offset: 8,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="du"
            name={series.duLabel}
            stroke={DU_COLOR}
            strokeWidth={2}
            fill="url(#trackDuGrad)"
            dot={false}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="fund"
            name={series.fundLabel}
            stroke={FUND_COLOR}
            strokeWidth={2}
            fill="url(#trackFundGrad)"
            dot={false}
            connectNulls={false}
          />
          {anchor && anchorVal != null && (
            <>
              <ReferenceLine x={anchor} stroke="var(--primary)" strokeDasharray="4 3" strokeOpacity={0.55} />
              <ReferenceDot
                x={anchor}
                y={anchorVal}
                r={5}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            </>
          )}
          {ddActive && dd && ddTroughVal != null && (
            <Customized component={(p: unknown) => (
              <DDLabel chart={p as ChartInternals} troughDate={dd.troughDate} troughVal={ddTroughVal} pct={ddPct} />
            )} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
