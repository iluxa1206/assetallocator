"use client";

import { useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine,
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

function shortDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${y}-${m}-${day}`;
}

const DEPOSIT_COLOR = "#10b981"; // emerald-500
const DEPOSIT_TERMS = [3, 6, 12] as const;

export function MainChart({ dates, portfolio, benchmark, cpi, deposit, portfolioName = "Портфель" }: Props) {
  const [showBench, setShowBench] = useState(true);
  const [showCpi, setShowCpi] = useState(true);
  const [showDeposit, setShowDeposit] = useState(true);
  const depositTerm = usePortfolioStore((s) => s.deposit_term_months);
  const setStore = usePortfolioStore((s) => s.set);

  const data = dates.map((d, i) => ({
    date: shortDate(d),
    portfolio: portfolio[i] != null ? +portfolio[i].toFixed(2) : null,
    benchmark: benchmark?.[i] != null ? +benchmark[i].toFixed(2) : null,
    cpi: cpi?.[i] != null ? +cpi[i].toFixed(2) : null,
    deposit: deposit?.[i] != null ? +deposit[i].toFixed(2) : null,
  }));

  // Fit Y-axis to visible series so small amplitudes (e.g. 95-110) aren't squished
  // by recharts' default [0, dataMax] domain.
  const visibleVals: number[] = [100]; // keep reference line in frame
  for (const row of data) {
    if (row.portfolio != null) visibleVals.push(row.portfolio);
    if (showBench && row.benchmark != null) visibleVals.push(row.benchmark);
    if (showCpi && row.cpi != null) visibleVals.push(row.cpi);
    if (showDeposit && row.deposit != null) visibleVals.push(row.deposit);
  }
  const minV = Math.min(...visibleVals);
  const maxV = Math.max(...visibleVals);
  const span = maxV - minV;
  const pad = Math.max(span * 0.08, 0.5);
  const yDomain: [number, number] = [
    Math.floor(minV - pad),
    Math.ceil(maxV + pad),
  ];

  const toggleBtn = (active: boolean, onClick: () => void, label: string, color: string) => (
    <button type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs rounded-full border transition-colors",
        active ? "border-transparent text-white font-medium" : "border-border text-muted-foreground hover:bg-muted"
      )}
      style={active ? { background: color } : {}}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold">Историческая динамика стратегии</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            График сравнения портфеля с композитным индексом, инфляцией и депозитом
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {toggleBtn(true, () => {}, portfolioName, "#2563eb")}
          {benchmark && toggleBtn(showBench, () => setShowBench((v) => !v), "Индекс", "#5b8fcc")}
          {cpi && toggleBtn(showCpi, () => setShowCpi((v) => !v), "Инфляция", "#9e9e9e")}
          {deposit && (
            <div className="flex items-center gap-1">
              {toggleBtn(showDeposit, () => setShowDeposit((v) => !v), "Депозит", DEPOSIT_COLOR)}
              <select
                value={depositTerm}
                onChange={(e) => setStore({ deposit_term_months: Number(e.target.value) })}
                className="text-xs rounded-full border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                title="Период капитализации депозита"
              >
                {DEPOSIT_TERMS.map((m) => (
                  <option key={m} value={m}>{m} мес</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={yDomain}
            allowDataOverflow={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: 12,
            }}
            formatter={(v) => (typeof v === "number" ? v.toFixed(1) : v)}
          />
          <Legend
            iconType="plainline"
            iconSize={16}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <ReferenceLine y={100} stroke="var(--border)" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="portfolio"
            name={`Портфель ${portfolioName}`}
            stroke="#2563eb"
            strokeWidth={2}
            fill="url(#portfolioGrad)"
            dot={false}
            connectNulls
          />
          {benchmark && showBench && (
            <Line
              type="monotone"
              dataKey="benchmark"
              name="Композитный индекс"
              stroke="#5b8fcc"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
            />
          )}
          {cpi && showCpi && (
            <Line
              type="monotone"
              dataKey="cpi"
              name="Инфляция"
              stroke="#9e9e9e"
              strokeWidth={1}
              strokeDasharray="2 4"
              dot={false}
              connectNulls
            />
          )}
          {deposit && showDeposit && (
            <Line
              type="monotone"
              dataKey="deposit"
              name={`Депозит ${depositTerm} мес`}
              stroke={DEPOSIT_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 2"
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
