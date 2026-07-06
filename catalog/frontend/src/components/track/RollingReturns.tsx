"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { fmtPct, fmtPctSimple } from "@/lib/format";
import type { TrackSeries } from "@/lib/track-data";
import { combinedSeries, rollingWindows, fmtDateRu, fmtMonthRu } from "@/lib/track-metrics";

type Horizon = 2 | 3 | "period";
type Mode = "cagr" | "abs";

const MODE_LABEL: Record<Mode, string> = { cagr: "Среднегодовая", abs: "Абсолютная" };
const HORIZON_LABEL: Record<string, string> = { 2: "2 года", 3: "3 года", period: "До конца периода" };
const HORIZON_OPTIONS = [2, 3, "period"] as const;

type TooltipEntry = { payload?: { entry: string; exit: string | null; cagr: number | null; abs: number | null } };
type RollingTooltipProps = { active?: boolean; payload?: TooltipEntry[]; mode: Mode };

function RollingTooltip({ active, payload, mode }: RollingTooltipProps) {
  const w = payload?.[0]?.payload;
  if (!active || !w || w.abs == null || !w.exit) return null;
  const rows: [string, number | null, boolean][] = [
    ["Среднегодовая", w.cagr, mode === "cagr"],
    ["Абсолютная", w.abs, mode === "abs"],
  ];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(10,14,28,0.35)]">
      <div className="font-semibold text-muted-foreground mb-1.5">
        Вход {fmtDateRu(w.entry)} → выход {fmtDateRu(w.exit)}
      </div>
      <div className="space-y-1 tabular-nums">
        {rows.map(([label, v, primary]) => (
          <div key={label} className="flex items-center gap-3">
            <span className={cn("flex-1", primary ? "text-foreground font-medium" : "text-muted-foreground")}>{label}</span>
            <span className={cn("font-semibold", v == null ? "text-muted-foreground" : v >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]")}>
              {v == null ? "— (< года)" : fmtPct(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Seg<T extends string | number>({ value, options, onChange, labels }: {
  value: T; options: readonly T[]; onChange: (v: T) => void; labels: (v: T) => string;
}) {
  return (
    <div className="flex border border-border rounded-md overflow-hidden">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "px-2.5 py-1.5 text-xs transition-colors tabular-nums",
            value === o
              ? "bg-primary text-primary-foreground font-semibold"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {labels(o)}
        </button>
      ))}
    </div>
  );
}

interface Props {
  series: TrackSeries;
  /** Видимое окно периода — те же точки, что в TrackChart: оси совпадают. */
  window: TrackSeries["points"];
}

/** Скользящие окна: результат инвестора при входе в каждый месяц трека.
 * Ось X повторяет основной график (одинаковые категории + syncId) —
 * периоды сопоставляются по вертикали. */
export function RollingReturns({ series, window: win }: Props) {
  const [horizon, setHorizon] = useState<Horizon>(3);
  const [mode, setMode] = useState<Mode>("cagr");

  // Окна с фиксированным горизонтом считаются по ПОЛНОЙ истории (выход может лежать
  // за границей периода); «до конца периода» — выход в последней точке видимого окна.
  // Видимость баров в обоих случаях определяет выбранный период.
  const { data, visible, periodExit } = useMemo(() => {
    let byEntry: Map<string, { exit: string; cagr: number | null; abs: number }>;
    let periodExit: string | null = null;
    if (horizon === "period") {
      const combined = combinedSeries(win);
      const end = combined[combined.length - 1];
      periodExit = end?.d ?? null;
      byEntry = new Map();
      for (const p of combined.slice(0, -1)) {
        if (p.v <= 0) continue;
        const years = (new Date(end.d).getTime() - new Date(p.d).getTime()) / (365.25 * 86_400_000);
        byEntry.set(p.d, {
          exit: end.d,
          abs: end.v / p.v - 1,
          // Аннуализация окон короче года даёт дикие проценты — не показываем CAGR.
          cagr: years >= 0.95 ? Math.pow(end.v / p.v, 1 / years) - 1 : null,
        });
      }
    } else {
      const stats = rollingWindows(combinedSeries(series.points), horizon);
      byEntry = new Map(stats?.windows.map((w) => [w.entry, w]) ?? []);
    }
    const data = win.map((p) => {
      const w = byEntry.get(p.d);
      return {
        entry: p.d,
        exit: w?.exit ?? null,
        cagr: w?.cagr ?? null,
        abs: w?.abs ?? null,
        value: w ? (mode === "cagr" ? w.cagr : w.abs) : null,
      };
    });
    const visible = data.filter((d) => d.value != null) as { entry: string; exit: string; cagr: number; abs: number; value: number }[];
    return { data, visible, periodExit };
  }, [series.points, win, horizon, mode]);

  if (!visible.length) {
    return (
      <div className="glossy rounded-2xl p-5">
        <p className="text-sm font-semibold">Доходность инвестора</p>
        <p className="text-xs text-muted-foreground mt-2">
          {horizon === "period"
            ? "В выбранном периоде нет входов старше года — среднегодовая не считается; переключитесь на «Абсолютная» или расширьте период."
            : `В выбранном периоде нет входов с полным горизонтом ${horizon} года — расширьте период или уменьшите горизонт.`}
        </p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Seg value={horizon} options={HORIZON_OPTIONS} onChange={setHorizon} labels={(h) => HORIZON_LABEL[String(h)]} />
          <Seg value={mode} options={["cagr", "abs"] as const} onChange={setMode} labels={(m) => MODE_LABEL[m as Mode]} />
        </div>
      </div>
    );
  }

  const vals = visible.map((d) => d.value);
  const minV = Math.min(...vals, 0);
  const maxV = Math.max(...vals, 0);
  const pad = Math.max((maxV - minV) * 0.08, 0.01);

  const sorted = [...visible].sort((a, b) => a.value - b.value);
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2].value
    : (sorted[sorted.length / 2 - 1].value + sorted[sorted.length / 2].value) / 2;
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  const positiveShare = visible.filter((d) => d.value > 0).length / visible.length;

  return (
    <div className="glossy rounded-2xl p-5">
      <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold">
            Доходность инвестора · {horizon === "period" ? "до конца периода" : `горизонт ${horizon} года`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {horizon === "period"
              ? `Каждый столбец — вход в этот месяц и выход ${periodExit ? fmtDateRu(periodExit) : "в конце периода"}${mode === "cagr" ? " · CAGR — для входов старше года" : ""}`
              : `Каждый столбец — вход в этот месяц и выход через ${horizon} года`} · {visible.length} окон
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Seg value={horizon} options={HORIZON_OPTIONS} onChange={setHorizon} labels={(h) => HORIZON_LABEL[String(h)]} />
          <Seg value={mode} options={["cagr", "abs"] as const} onChange={setMode} labels={(m) => MODE_LABEL[m as Mode]} />
        </div>
      </div>

      {/* Сводка по окнам */}
      <div className="flex gap-x-6 gap-y-1 flex-wrap text-xs text-muted-foreground mb-3 mt-2 tabular-nums">
        <span>
          Худшее окно:{" "}
          <span className={cn("font-semibold", worst.value >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]")}>
            {fmtPct(worst.value)}
          </span>{" "}
          (вход {fmtMonthRu(worst.entry)})
        </span>
        <span>
          Медиана:{" "}
          <span className={cn("font-semibold", median >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]")}>
            {fmtPct(median)}
          </span>
        </span>
        <span>
          Лучшее окно:{" "}
          <span className={cn("font-semibold", best.value >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]")}>
            {fmtPct(best.value)}
          </span>{" "}
          (вход {fmtMonthRu(best.entry)})
        </span>
        <span>
          Прибыльных окон:{" "}
          <span className="font-semibold text-foreground">{fmtPctSimple(positiveShare, 0)}</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} syncId="track" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="entry"
            tickFormatter={fmtMonthRu}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            minTickGap={48}
          />
          <YAxis
            domain={[minV - pad, maxV + pad]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tickLine={false}
            axisLine={false}
            width={44}
            tickCount={6}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
            content={<RollingTooltip mode={mode} />}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Bar dataKey="value" name={MODE_LABEL[mode]} maxBarSize={14} radius={[2, 2, 0, 0]}>
            {data.map((d) => (
              <Cell
                key={d.entry}
                fill={d.value != null && d.value >= 0 ? "var(--pos)" : "var(--neg)"}
                fillOpacity={0.75}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-[11px] text-muted-foreground/70 mt-2">
        Ось X совпадает с графиком выше: столбец под точкой трека — результат входа в этот месяц.{" "}
        {horizon === "period"
          ? "Выход у всех окон общий — последняя точка выбранного периода."
          : `Окна считаются по полной истории (${series.duLabel} → ${series.fundLabel}); выход может лежать за границей периода.`}
      </p>
    </div>
  );
}
