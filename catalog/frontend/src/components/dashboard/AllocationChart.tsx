"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { FundComponent } from "@/lib/types";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { RISK_PROFILES, CCY_STRATEGIES } from "@/lib/types";
import { fmtCompact } from "@/lib/format";

// RUB funds — blue; FX funds — indigo/cyan
const FUND_COLORS: Record<string, string> = {
  R5:     "#2563eb",
  Aplus:  "#3b82f6",
  A12080: "#60a5fa",
  R1:     "#93c5fd",
  Liq:    "#bfdbfe",
  D5:     "#4f46e5",
  Yu5:    "#6366f1",
  D1:     "#0891b2",
  VO:     "#06b6d4",
  M3:     "#22d3ee",
};

const CCY_COLORS: Record<string, string> = {
  RUB: "#2563eb",
  USD: "#4f46e5",
  CNY: "#0891b2",
  GLD: "#1e3a8a",
};

const CCY_NAMES: Record<string, string> = {
  RUB: "Рубль",
  USD: "Доллар США",
  CNY: "Китайский юань",
  GLD: "Золото",
};


function FundTooltip(props: Record<string, unknown>) {
  const { active, payload } = props as { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; payload?: { fill?: string } }> };
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const color = d.payload?.fill ?? d.color ?? "#888";
  return (
    <div
      className="rounded-xl border border-border bg-popover px-3 py-2 shadow-xl text-xs"
      style={{ zIndex: 9999, pointerEvents: "none", minWidth: 140 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
        <span className="font-semibold text-popover-foreground truncate max-w-[160px]">{d.name}</span>
      </div>
      <div className="text-muted-foreground tabular-nums">
        {typeof d.value === "number" ? d.value.toFixed(1) : d.value}%
      </div>
    </div>
  );
}

interface Props {
  components: FundComponent[];
  amount: number;
  amountCcy: string;
  currencyBreakdown: Record<string, number>;
  investedBase: number | null;
  baseCurrency: string;
}

export function AllocationChart({ components, amount, amountCcy, currencyBreakdown, investedBase, baseCurrency }: Props) {
  const s = usePortfolioStore();

  const allocData = components
    .filter((c) => c.weight > 0.1)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => ({ name: c.fund_key, label: c.fund_name, value: c.weight }));

  const ccyData = Object.entries(currencyBreakdown)
    .filter(([, v]) => v > 0.1)
    .map(([k, v]) => ({ name: k, value: v }));

  const rubPct = currencyBreakdown.RUB ?? 0;
  const valPct = (currencyBreakdown.USD ?? 0) + (currencyBreakdown.CNY ?? 0) + (currencyBreakdown.GLD ?? 0);

  const totalBase = investedBase ?? amount;
  const riskProfile = RISK_PROFILES[s.risk];
  const ccyStrategy = CCY_STRATEGIES[s.ccy];
  const fundCount = components.filter((c) => c.weight > 0).length;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Allocation card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Аллокация по фондам</p>
          <p className="text-xs text-muted-foreground">{riskProfile?.name} · {fundCount} фондов</p>
        </div>

        {/* Donut — centered, large */}
        <div className="flex justify-center mb-5">
          <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
            <PieChart width={220} height={220}>
              <Pie
                data={allocData}
                dataKey="value"
                cx={110}
                cy={110}
                innerRadius={68}
                outerRadius={104}
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={false}
              >
                {allocData.map((e) => (
                  <Cell key={e.name} fill={FUND_COLORS[e.name] ?? "#888"} />
                ))}
              </Pie>
              <Tooltip content={FundTooltip} wrapperStyle={{ zIndex: 9999 }} />
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-base font-bold leading-tight">{fmtCompact(amount, amountCcy)}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">ВСЕГО</span>
            </div>
          </div>
        </div>

        {/* Fund list — below chart */}
        <div className="space-y-2 text-xs">
          {allocData.map((e) => {
            const comp = components.find((c) => c.fund_key === e.name);
            return (
              <div key={e.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: FUND_COLORS[e.name] ?? "#888" }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{comp?.fund_name ?? e.name}</p>
                  <p className="text-muted-foreground text-[10px]">{comp?.native_currency} · {comp?.benchmark_label}</p>
                </div>
                <span className="tabular-nums font-medium shrink-0">{e.value.toFixed(1)}%</span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {fmtCompact(totalBase * e.value / 100, baseCurrency)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Currency card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Распределение по валютам</p>
          <p className="text-xs text-muted-foreground">{ccyStrategy?.name ?? "—"}</p>
        </div>

        {/* Donut — centered, large */}
        <div className="flex justify-center mb-5">
          <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
            <PieChart width={220} height={220}>
              <Pie
                data={ccyData}
                dataKey="value"
                cx={110}
                cy={110}
                innerRadius={68}
                outerRadius={104}
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={false}
              >
                {ccyData.map((e) => (
                  <Cell key={e.name} fill={CCY_COLORS[e.name] ?? "#888"} />
                ))}
              </Pie>
              <Tooltip content={FundTooltip} wrapperStyle={{ zIndex: 9999 }} />
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-base font-bold leading-tight">{rubPct.toFixed(0)} / {valPct.toFixed(0)}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">ВАЛЮТНЫЙ МИКС</span>
            </div>
          </div>
        </div>

        {/* CCY list — below chart */}
        <div className="space-y-1 text-xs">
          {/* RUB row */}
          <div className="flex items-center gap-2 py-1 border-b border-border/50">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CCY_COLORS.RUB }} />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Рубль</p>
              <p className="text-muted-foreground text-[10px]">RUB</p>
            </div>
            <span className="tabular-nums font-medium shrink-0">{rubPct.toFixed(1)}%</span>
            <span className="tabular-nums text-muted-foreground shrink-0">{fmtCompact(totalBase * rubPct / 100, baseCurrency)}</span>
          </div>

          {/* Валюта summary */}
          <div className="flex items-center gap-2 py-1 border-b border-border/50">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 opacity-60" style={{ background: CCY_COLORS.USD }} />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Валюта</p>
              <p className="text-muted-foreground text-[10px]">
                {Object.keys(currencyBreakdown).filter((k) => k !== "RUB" && (currencyBreakdown[k] ?? 0) > 0.1).join(" · ")}
              </p>
            </div>
            <span className="tabular-nums font-medium shrink-0">{valPct.toFixed(1)}%</span>
            <span className="tabular-nums text-muted-foreground shrink-0">{fmtCompact(totalBase * valPct / 100, baseCurrency)}</span>
          </div>

          {/* Individual FX */}
          {(["USD", "CNY", "GLD"] as const).filter((k) => (currencyBreakdown[k] ?? 0) > 0.1).map((k) => (
            <div key={k} className="flex items-center gap-2 py-0.5 pl-3">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: CCY_COLORS[k] }} />
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground">{CCY_NAMES[k]}</p>
                <p className="text-muted-foreground/60 text-[10px]">{k}</p>
              </div>
              <span className="tabular-nums text-muted-foreground shrink-0">{(currencyBreakdown[k] ?? 0).toFixed(1)}%</span>
              <span className="tabular-nums text-muted-foreground/70 shrink-0">{fmtCompact(totalBase * (currencyBreakdown[k] ?? 0) / 100, baseCurrency)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
