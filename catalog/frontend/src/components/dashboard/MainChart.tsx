"use client";

import { useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea, Customized,
} from "recharts";
import { cn } from "@/lib/utils";
import { usePortfolioStore } from "@/stores/portfolioStore";

interface Props {
  dates: string[];
  portfolio: number[];
  benchmark: number[] | null;
  cpi: number[] | null;
  deposit: number[] | null;
  portfolioName?: string;
}

const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function shortDate(d: string) {
  const [y, m] = d.split("-");
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

// Institutional, restrained line palette — each series visually distinct.
const PORTFOLIO_COLOR = "var(--primary)";   // navy, solid
const INDEX_COLOR   = "var(--chart-5)";     // teal, dashed
const CPI_COLOR     = "var(--muted-foreground)"; // grey, dotted
const DEPOSIT_COLOR = "var(--pos)";          // green, dashed
const DEPOSIT_TERMS = [3, 6, 12] as const;

function lastNonNull(arr: number[] | null | undefined): number | null {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
}

/** Largest peak-to-trough decline; returns bounding indices for shading. */
function maxDrawdown(pts: number[]): { dd: number; peakIdx: number; troughIdx: number } {
  let curPeak = pts[0] ?? 0, curPeakIdx = 0;
  let dd = 0, peakIdx = 0, troughIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i] != null && pts[i] > curPeak) { curPeak = pts[i]; curPeakIdx = i; }
    const d = curPeak > 0 ? (pts[i] - curPeak) / curPeak : 0;
    if (d < dd) { dd = d; peakIdx = curPeakIdx; troughIdx = i; }
  }
  return { dd, peakIdx, troughIdx };
}

type ChartInternals = {
  xAxisMap?: Record<string, { scale?: ((v: string) => number) & { bandwidth?: () => number } }>;
  yAxisMap?: Record<string, { scale?: (v: number) => number }>;
  offset?: { left: number; top: number; width: number; height: number };
};

/** Drawdown trough marker + depth label, drawn via Customized so the label can be
 * clamped inside the plot (never clips at the edges, even for start-anchored drawdowns). */
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
type MainTooltipProps = { active?: boolean; payload?: TooltipEntry[]; label?: string };

/** Unified tooltip: all visible series at the hovered date + delta vs the portfolio. */
function MainTooltip({ active, payload, label }: MainTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const portRaw = payload.find((p) => p.dataKey === "portfolio")?.value;
  const port = typeof portRaw === "number" ? portRaw : null;
  const fmt = (n: number) => n.toFixed(1).replace(".", ",");
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(10,14,28,0.35)]">
      <div className="font-semibold text-muted-foreground mb-1.5">{label}</div>
      <div className="space-y-1">
        {payload.map((p) => {
          const v = typeof p.value === "number" ? p.value : null;
          if (v == null) return null;
          const isPort = p.dataKey === "portfolio";
          const d = !isPort && port != null ? v - port : null;
          return (
            <div key={String(p.dataKey)} className="flex items-center gap-2 tabular-nums">
              <span className="h-[3px] w-3 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="text-muted-foreground flex-1 pr-3">{p.name}</span>
              <span className="font-semibold text-foreground">{fmt(v)}</span>
              {d != null && (
                <span className={d >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]"}>
                  {d >= 0 ? "+" : "−"}{fmt(Math.abs(d))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Renders end-of-line value markers at the right plot edge, de-colliding overlapping labels. */
function EndLabels({ chart, series }: { chart: ChartInternals; series: { val: number; color: string }[] }) {
  const yMap = chart.yAxisMap;
  const offset = chart.offset;
  if (!yMap || !offset || !series.length) return null;
  const firstKey = Object.keys(yMap)[0];
  const yScale = yMap[firstKey]?.scale;
  if (typeof yScale !== "function") return null;

  const rightX = offset.left + offset.width;
  const items = series
    .map((s) => ({ ...s, dataY: yScale(s.val), labelY: yScale(s.val) }))
    .sort((a, b) => a.dataY - b.dataY);
  const minGap = 14;
  for (let i = 1; i < items.length; i++) {
    if (items[i].labelY - items[i - 1].labelY < minGap) {
      items[i].labelY = items[i - 1].labelY + minGap;
    }
  }
  return (
    <g>
      {items.map((it, i) => (
        <g key={i}>
          <circle cx={rightX} cy={it.dataY} r={3} fill={it.color} stroke="var(--card)" strokeWidth={1.5} />
          <text x={rightX + 7} y={it.labelY} dy={4} fontSize={12} fontWeight={700} fill={it.color}>
            {Math.round(it.val)}
          </text>
        </g>
      ))}
    </g>
  );
}

export function MainChart({ dates, portfolio, benchmark, cpi, deposit, portfolioName = "Портфель" }: Props) {
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [showBench,     setShowBench]     = useState(true);
  const [showCpi,       setShowCpi]       = useState(true);
  const [showDeposit,   setShowDeposit]   = useState(true);
  const [showDD,        setShowDD]        = useState(true);
  const depositTerm = usePortfolioStore((s) => s.deposit_term_months);
  const setStore    = usePortfolioStore((s) => s.set);

  const data = dates.map((d, i) => ({
    date:      shortDate(d),
    portfolio: portfolio[i] != null ? +portfolio[i].toFixed(2) : null,
    benchmark: benchmark?.[i] != null ? +benchmark[i].toFixed(2) : null,
    cpi:       cpi?.[i] != null ? +cpi[i].toFixed(2) : null,
    deposit:   deposit?.[i] != null ? +deposit[i].toFixed(2) : null,
  }));

  const visibleVals: number[] = [100];
  for (const row of data) {
    if (row.portfolio != null) visibleVals.push(row.portfolio);
    if (showBench   && row.benchmark != null) visibleVals.push(row.benchmark);
    if (showCpi     && row.cpi       != null) visibleVals.push(row.cpi);
    if (showDeposit && row.deposit   != null) visibleVals.push(row.deposit);
  }
  const minV = Math.min(...visibleVals);
  const maxV = Math.max(...visibleVals);
  const span = maxV - minV;
  const pad  = Math.max(span * 0.08, 0.5);
  // Round domain to clean multiples of 10 for legible axis ticks.
  const yDomain: [number, number] = [
    Math.floor((minV - pad) / 10) * 10,
    Math.ceil((maxV + pad) / 10) * 10,
  ];

  // Max drawdown of the portfolio series — shaded peak→trough band + trough marker.
  const dd = maxDrawdown(portfolio);
  const ddActive = showDD && showPortfolio && dd.dd < -0.02 && dd.troughIdx > dd.peakIdx
    && dd.peakIdx < data.length && dd.troughIdx < data.length;
  const ddPct = `−${Math.abs(dd.dd * 100).toFixed(1).replace(".", ",")}%`;
  const ddTroughVal = ddActive ? data[dd.troughIdx].portfolio : null;

  const lastDate = data.length ? data[data.length - 1].date : null;
  const endLabels = [
    { show: showPortfolio, val: lastNonNull(portfolio), color: PORTFOLIO_COLOR },
    { show: showBench,     val: lastNonNull(benchmark), color: INDEX_COLOR },
    { show: showCpi,       val: lastNonNull(cpi),       color: CPI_COLOR },
    { show: showDeposit,   val: lastNonNull(deposit),   color: DEPOSIT_COLOR },
  ].filter((e) => e.show && e.val != null) as { show: boolean; val: number; color: string }[];

  /** Legend-style toggle: neutral chip + a coloured line-swatch carrying the series colour + dash pattern. */
  const LegendToggle = ({
    active, onClick, label, color, pattern = "solid",
  }: { active: boolean; onClick: () => void; label: string; color: string; pattern?: "solid" | "dashed" | "dotted" }) => {
    const swatch =
      pattern === "dashed"
        ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 8px)` }
        : pattern === "dotted"
          ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 2px, transparent 2px 5px)` }
          : { background: color };
    return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
        active
          ? "border-border bg-muted/50 text-foreground"
          : "border-transparent text-muted-foreground/55 hover:text-foreground hover:bg-muted/30"
      )}
    >
      <span
        className="h-[3px] w-4 rounded-full shrink-0"
        style={{ opacity: active ? 1 : 0.35, ...swatch }}
      />
      <span className={cn(!active && "line-through decoration-1")}>{label}</span>
    </button>
    );
  };

  return (
    <div className="glossy rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold">Историческая динамика стратегии</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Сравнение портфеля с индексом, инфляцией и депозитом · индекс, старт = 100
          </p>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap">
          <LegendToggle active={showPortfolio} onClick={() => setShowPortfolio((v) => !v)} label={portfolioName} color={PORTFOLIO_COLOR} pattern="solid" />
          {benchmark && <LegendToggle active={showBench} onClick={() => setShowBench((v) => !v)} label="Индекс"   color={INDEX_COLOR} pattern="dashed" />}
          {cpi       && <LegendToggle active={showCpi}   onClick={() => setShowCpi((v) => !v)}   label="Инфляция" color={CPI_COLOR}   pattern="dotted" />}
          {/* Drawdown shading toggle */}
          <button
            type="button"
            onClick={() => setShowDD((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
              showDD ? "border-border bg-muted/50 text-foreground" : "border-transparent text-muted-foreground/55 hover:text-foreground hover:bg-muted/30",
            )}
          >
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: "color-mix(in oklab, var(--neg) 22%, transparent)", border: "1px solid color-mix(in oklab, var(--neg) 45%, transparent)" }} />
            <span className={cn(!showDD && "line-through decoration-1")}>Просадка</span>
          </button>
          {deposit   && (
            <div className="flex items-center gap-1">
              <LegendToggle active={showDeposit} onClick={() => setShowDeposit((v) => !v)} label="Депозит" color={DEPOSIT_COLOR} pattern="dashed" />
              {/* Deposit term selector */}
              <div className="flex border border-border rounded-md overflow-hidden">
                {DEPOSIT_TERMS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setStore({ deposit_term_months: m })}
                    className={cn(
                      "px-2.5 py-1.5 text-xs transition-colors tabular-nums",
                      depositTerm === m
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {m}м
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 46, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="var(--primary)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            minTickGap={48}
          />
          <YAxis
            domain={yDomain}
            allowDataOverflow={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickCount={6}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 3" }}
            content={<MainTooltip />}
          />
          {ddActive && (
            <ReferenceArea
              x1={data[dd.peakIdx].date}
              x2={data[dd.troughIdx].date}
              fill="var(--neg)"
              fillOpacity={0.14}
              stroke="var(--neg)"
              strokeOpacity={0.3}
              strokeWidth={1}
              ifOverflow="extendDomain"
            />
          )}
          <ReferenceLine y={100} stroke="var(--border)" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="portfolio"
            name={`Портфель ${portfolioName}`}
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#portfolioGrad)"
            dot={false}
            connectNulls
            hide={!showPortfolio}
          />
          {benchmark && (
            <Line
              type="monotone"
              dataKey="benchmark"
              name="Композитный индекс"
              stroke={INDEX_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
              hide={!showBench}
            />
          )}
          {cpi && (
            <Line
              type="monotone"
              dataKey="cpi"
              name="Инфляция"
              stroke={CPI_COLOR}
              strokeWidth={1}
              strokeDasharray="2 4"
              dot={false}
              connectNulls
              hide={!showCpi}
            />
          )}
          {deposit && (
            <Line
              type="monotone"
              dataKey="deposit"
              name={`Депозит ${depositTerm} мес`}
              stroke={DEPOSIT_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 2"
              dot={false}
              connectNulls
              hide={!showDeposit}
            />
          )}
          {/* Drawdown trough marker + clamped depth label */}
          {ddActive && ddTroughVal != null && (
            <Customized component={(p: unknown) => (
              <DDLabel chart={p as ChartInternals} troughDate={data[dd.troughIdx].date} troughVal={ddTroughVal} pct={ddPct} />
            )} />
          )}
          {/* End-of-line value markers — placed at the right plot edge with collision avoidance */}
          <Customized component={(p: unknown) => <EndLabels chart={p as ChartInternals} series={endLabels} />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
