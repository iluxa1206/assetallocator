"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTabsPill } from "@/hooks/useTabsPill";
import { MonthYearPicker } from "@/components/dashboard/MonthYearPicker";
import { TrackChart } from "@/components/track/TrackChart";
import { TrackMetricsGrid, AnchorPanel } from "@/components/track/TrackMetrics";
import { RollingReturns } from "@/components/track/RollingReturns";
import { DrawdownBars } from "@/components/track/DrawdownBars";
import { TRACKS, type TrackSeries } from "@/lib/track-data";
import { combinedSeries, computeMetrics, fmtDateRu } from "@/lib/track-metrics";

type RangeKey = "1y" | "3y" | "5y" | "10y" | "ytd" | "max" | "custom";

const RANGE_YEARS: Partial<Record<RangeKey, number>> = { "1y": 1, "3y": 3, "5y": 5, "10y": 10 };
const RANGE_LABEL: Record<Exclude<RangeKey, "custom">, string> = {
  "1y": "1Г", "3y": "3Г", "5y": "5Л", "10y": "10Л", ytd: "YTD", max: "Всё",
};

/** Чип-переключатель видимости блока (галочка + подпись). */
function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border",
          active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground-2",
        )}
      >
        {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}

function shiftYears(iso: string, years: number): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** Индекс стартовой точки окна: последняя точка ≤ cutoff (база периода). */
function startIdxFor(points: TrackSeries["points"], cutoff: string): number {
  let idx = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].d <= cutoff) idx = i;
    else break;
  }
  return idx;
}

function windowFor(
  series: TrackSeries,
  range: RangeKey,
  custom: { from: string; to: string } | null,
): TrackSeries["points"] {
  const pts = series.points;
  if (!pts.length) return pts;
  if (range === "max") return pts;
  if (range === "custom" && custom) {
    const i = pts.findIndex((p) => p.d === custom.from);
    const j = pts.findIndex((p) => p.d === custom.to);
    if (i >= 0 && j > i) return pts.slice(i, j + 1);
    return pts;
  }
  const last = pts[pts.length - 1].d;
  if (range === "ytd") {
    const cutoff = `${last.slice(0, 4)}-01-01`;
    let idx = 0;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].d < cutoff) idx = i;
      else break;
    }
    return pts.slice(idx);
  }
  const years = RANGE_YEARS[range];
  if (!years) return pts;
  return pts.slice(startIdxFor(pts, shiftYears(last, years)));
}

function TrackSection({ series }: { series: TrackSeries }) {
  const [range, setRange] = useState<RangeKey>("max");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [showDrawdown, setShowDrawdown] = useState(true);
  const [showInvestor, setShowInvestor] = useState(true);

  const pts = series.points;
  const firstDate = pts[0].d;
  const lastDate = pts[pts.length - 1].d;

  // Показываем только периоды, которые короче всей истории.
  const rangeOptions = useMemo(() => {
    const opts: RangeKey[] = [];
    for (const k of ["1y", "3y", "5y", "10y"] as const) {
      if (shiftYears(lastDate, RANGE_YEARS[k]!) > firstDate) opts.push(k);
    }
    opts.push("ytd", "max");
    return opts;
  }, [firstDate, lastDate]);

  const win = useMemo(() => windowFor(series, range, custom), [series, range, custom]);
  const combined = useMemo(() => combinedSeries(win), [win]);
  const metrics = useMemo(() => computeMetrics(combined), [combined]);

  const anchorValid = anchor != null && combined.some((p) => p.d === anchor) ? anchor : null;
  const anchorMetrics = useMemo(() => {
    if (!anchorValid) return null;
    const i = combined.findIndex((p) => p.d === anchorValid);
    return i >= 0 ? computeMetrics(combined.slice(i)) : null;
  }, [anchorValid, combined]);

  const { barRef, pillRef } = useTabsPill(range);
  const availableDates = useMemo(() => pts.map((p) => p.d), [pts]);

  const pickCustom = (from: string, to: string) => {
    if (from >= to) return;
    setCustom({ from, to });
    setRange("custom");
    setAnchor(null);
  };
  const winFrom = win[0].d;
  const winTo = win[win.length - 1].d;

  return (
    <div className="space-y-4">
      {/* Период */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div ref={barRef} className="relative inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Период">
          <span ref={pillRef} className={cn("t-tabs-pill", range === "custom" && "opacity-0")} aria-hidden="true" />
          {rangeOptions.map((k) => {
            const active = range === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => { setRange(k); setCustom(null); setAnchor(null); }}
                data-selected={active || undefined}
                className={cn(
                  "relative z-10 rounded-md font-medium tabular-nums transition-colors px-2.5 py-1 text-xs",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {RANGE_LABEL[k as Exclude<RangeKey, "custom">]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Период:</span>
          <MonthYearPicker value={winFrom} onChange={(d) => pickCustom(d, winTo)} availableDates={availableDates} monthAnchor="first" />
          <span className="text-xs text-muted-foreground">—</span>
          <MonthYearPicker value={winTo} onChange={(d) => pickCustom(winFrom, d)} availableDates={availableDates} />
        </div>
      </div>

      <TrackChart series={series} window={win} anchor={anchorValid} onAnchor={setAnchor} />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Блоки:</span>
        <ToggleChip active={showDrawdown} onClick={() => setShowDrawdown((v) => !v)}>Просадка</ToggleChip>
        <ToggleChip active={showInvestor} onClick={() => setShowInvestor((v) => !v)}>Результат инвестора</ToggleChip>
      </div>

      {showDrawdown && <DrawdownBars series={series} window={win} />}

      {showInvestor && <RollingReturns series={series} window={win} />}

      {anchorMetrics && <AnchorPanel m={anchorMetrics} onClear={() => setAnchor(null)} />}

      {metrics && <TrackMetricsGrid m={metrics} />}

      <p className="text-[11px] text-muted-foreground-2">
        Трек: {series.duLabel} с {fmtDateRu(firstDate)}, с {fmtDateRu(series.transitionDate)} — {series.fundLabel}.
        Ряд месячный, индекс накопленной доходности; старт выбранного периода принят за 100.
      </p>
    </div>
  );
}

export default function TrackPage() {
  const [tab, setTab] = useState<"rub" | "usd">("rub");
  const { barRef, pillRef } = useTabsPill(tab);
  const series = TRACKS.find((t) => t.key === tab)!;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Трек</h1>
        <p className="text-sm text-muted-foreground mt-1">
          История управления: пул стратегий ДУ и фонд после трансформации
        </p>
      </div>

      <div ref={barRef} className="relative inline-flex rounded-lg border border-border bg-muted/40 p-0.5 mb-5" role="tablist" aria-label="Стратегия">
        <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
        {TRACKS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              data-selected={active || undefined}
              className={cn(
                "relative z-10 rounded-md font-medium transition-colors px-3.5 py-1.5 text-sm",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.title}
            </button>
          );
        })}
      </div>

      {/* key — сброс состояния периода/якоря при смене вкладки */}
      <TrackSection key={series.key} series={series} />
    </div>
  );
}
