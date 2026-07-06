"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { FundComponent, ExternalItem } from "@/lib/types";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { RISK_PROFILES, CCY_STRATEGIES, ASSET_CLASS_LABEL } from "@/lib/types";
import { fmtCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

// Coherent institutional ramp: deep navy → light steel. Largest holdings render darkest.
const FUND_RAMP = [
  "#1e2b52", "#26396e", "#2a4ba0", "#39599f", "#4b6aad",
  "#5f7cba", "#7791c9", "#92a8d6", "#aebde3", "#c9d4ee",
];
const fundColor = (i: number) => FUND_RAMP[i % FUND_RAMP.length];

// External assets — neutral warm-grey ramp, visually distinct from our navy funds.
const EXT_RAMP = ["#6b7280", "#7d8494", "#9098a6", "#a4abb8", "#b8becb"];
const extColor = (j: number) => EXT_RAMP[j % EXT_RAMP.length];

const CCY_COLORS: Record<string, string> = {
  RUB: "#2a4ba0",
  USD: "#4b6aad",
  CNY: "#7791c9",
  GLD: "#9aa6c8",
};

const CCY_NAMES: Record<string, string> = {
  RUB: "Рубль",
  USD: "Доллар США",
  CNY: "Китайский юань",
  GLD: "Золото",
};


function FundTooltip(props: Record<string, unknown>) {
  const { active, payload } = props as {
    active?: boolean;
    payload?: Array<{ name?: string; value?: number; color?: string; payload?: { fill?: string; color?: string; label?: string; pct?: number } }>;
  };
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const sl = d.payload ?? {};
  const color = sl.color ?? sl.fill ?? d.color ?? "#888";
  const label = sl.label ?? d.name ?? "";
  const pct = typeof sl.pct === "number" ? sl.pct : typeof d.value === "number" ? d.value : 0;
  return (
    <div
      className="rounded-xl border border-border bg-popover px-3 py-2 shadow-xl text-xs"
      style={{ zIndex: 9999, pointerEvents: "none", minWidth: 140 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
        <span className="font-semibold text-popover-foreground truncate max-w-[160px]">{label}</span>
      </div>
      <div className="text-muted-foreground tabular-nums">{pct.toFixed(1).replace(".", ",")}%</div>
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
  externalAdjusted?: boolean;
  externalItems?: ExternalItem[];
  ourCurrencyBase?: Record<string, number>;
  externalCurrencyBase?: Record<string, number>;
}

type Slice = { key: string; label: string; sub: string; color: string; money: number; pct: number };

export function AllocationChart({ components, amount, amountCcy, currencyBreakdown, investedBase, baseCurrency, externalAdjusted, externalItems = [], ourCurrencyBase = {}, externalCurrencyBase = {} }: Props) {
  const s = usePortfolioStore();
  const hasExternal = externalItems.length > 0;
  const [scope, setScope] = useState<"funds" | "total">("funds");
  const view = hasExternal ? scope : "funds";

  const totalBase = investedBase ?? amount;
  const riskProfile = RISK_PROFILES[s.risk];
  const ccyStrategy = CCY_STRATEGIES[s.ccy];
  const fundCount = components.filter((c) => c.weight > 0).length;

  const fundsSorted = components.filter((c) => c.weight > 0.1).sort((a, b) => b.weight - a.weight);
  const extTotal = externalItems.reduce((a, e) => a + e.base_value, 0);
  const grand = totalBase + extTotal;

  // Unified slices for the active scope. `money` drives the donut, `pct` the labels.
  let slices: Slice[];
  let centerValue: string;
  let centerLabel: string;
  if (view === "total") {
    const fundSlices: Slice[] = fundsSorted.map((c, i) => ({
      key: c.fund_key,
      label: c.fund_name,
      sub: `${c.native_currency} · фонд`,
      color: fundColor(i),
      money: c.invested_base,
      pct: grand > 0 ? (c.invested_base / grand) * 100 : 0,
    }));
    const extSlices: Slice[] = externalItems.map((e, j) => ({
      key: `ext-${j}`,
      label: e.name,
      sub: `${ASSET_CLASS_LABEL[e.asset_class] ?? e.asset_class} · ${e.currency} · внешний`,
      color: extColor(j),
      money: e.base_value,
      pct: grand > 0 ? (e.base_value / grand) * 100 : 0,
    }));
    slices = [...fundSlices, ...extSlices];
    centerValue = fmtCompact(grand, baseCurrency);
    centerLabel = "КАПИТАЛ";
  } else {
    slices = fundsSorted.map((c, i) => ({
      key: c.fund_key,
      label: c.fund_name,
      sub: `${c.native_currency} · ${c.benchmark_label}`,
      color: fundColor(i),
      money: totalBase * c.weight / 100,
      pct: c.weight,
    }));
    centerValue = fmtCompact(amount, amountCcy);
    centerLabel = "ВСЕГО";
  }

  // Currency breakdown for the active scope (our funds only / whole capital incl. external).
  const CCY_KEYS = ["RUB", "USD", "CNY", "GLD"];
  const ccyView: Record<string, { pct: number; money: number }> = {};
  for (const k of CCY_KEYS) {
    if (view === "total") {
      const money = (ourCurrencyBase[k] ?? 0) + (externalCurrencyBase[k] ?? 0);
      ccyView[k] = { money, pct: grand > 0 ? (money / grand) * 100 : 0 };
    } else {
      const pct = currencyBreakdown[k] ?? 0;
      ccyView[k] = { pct, money: totalBase * pct / 100 };
    }
  }
  const rubV = ccyView.RUB;
  const valPctV = (ccyView.USD?.pct ?? 0) + (ccyView.CNY?.pct ?? 0) + (ccyView.GLD?.pct ?? 0);
  const valMoneyV = (ccyView.USD?.money ?? 0) + (ccyView.CNY?.money ?? 0) + (ccyView.GLD?.money ?? 0);
  const fxKeys = (["USD", "CNY", "GLD"] as const).filter((k) => (ccyView[k]?.money ?? 0) > 0.5);
  const ccyData = CCY_KEYS
    .filter((k) => (ccyView[k]?.money ?? 0) > 0.5)
    .map((k) => ({ name: k, value: ccyView[k].money, pct: ccyView[k].pct, color: CCY_COLORS[k], label: CCY_NAMES[k] }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Allocation card */}
      <div className="glossy rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {view === "total" ? "Распределение капитала" : "Аллокация по фондам"}
            </p>
            {externalAdjusted && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary ring-1 ring-primary/20 shrink-0"
                title="Веса фондов скорректированы под внешние активы клиента"
              >
                скорр.
              </span>
            )}
          </div>
          {!hasExternal && <p className="text-xs text-muted-foreground shrink-0">{riskProfile?.name} · {fundCount} фондов</p>}
        </div>

        {/* Scope toggle — only when external assets present */}
        {hasExternal && (
          <div className="flex glossy rounded-lg p-0.5 w-fit mb-5 text-xs">
            {(["funds", "total"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setScope(v)}
                className={cn(
                  "px-3 py-1 rounded-md font-semibold transition-colors",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "funds" ? "Наши фонды" : "Весь капитал"}
              </button>
            ))}
          </div>
        )}

        {/* Donut */}
        <div className="flex justify-center mb-5">
          <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
            <PieChart width={220} height={220}>
              <Pie
                data={slices}
                dataKey="money"
                nameKey="label"
                cx={110}
                cy={110}
                innerRadius={68}
                outerRadius={104}
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {slices.map((e) => (
                  <Cell key={e.key} fill={e.color} />
                ))}
              </Pie>
              <Tooltip content={FundTooltip} wrapperStyle={{ zIndex: 9999 }} />
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-base font-bold leading-tight">{centerValue}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1">{centerLabel}</span>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2 text-xs">
          {slices.map((e) => (
            <div key={e.key} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: e.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{e.label}</p>
                <p className="text-muted-foreground text-[10px] truncate">{e.sub}</p>
              </div>
              <span className="tabular-nums font-medium shrink-0">{e.pct.toFixed(1).replace(".", ",")}%</span>
              <span className="tabular-nums text-muted-foreground shrink-0">{fmtCompact(e.money, baseCurrency)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Currency card */}
      <div className="glossy rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Распределение по валютам</p>
          <p className="text-xs text-muted-foreground">{view === "total" ? "весь капитал" : (ccyStrategy?.name ?? "—")}</p>
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
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {ccyData.map((e) => (
                  <Cell key={e.name} fill={e.color ?? "#888"} />
                ))}
              </Pie>
              <Tooltip content={FundTooltip} wrapperStyle={{ zIndex: 9999 }} />
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-base font-bold leading-tight">{(rubV?.pct ?? 0).toFixed(0)} / {valPctV.toFixed(0)}</span>
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
            <span className="tabular-nums font-medium shrink-0">{(rubV?.pct ?? 0).toFixed(1).replace(".", ",")}%</span>
            <span className="tabular-nums text-muted-foreground shrink-0">{fmtCompact(rubV?.money ?? 0, baseCurrency)}</span>
          </div>

          {/* Валюта summary */}
          <div className="flex items-center gap-2 py-1 border-b border-border/50">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0 opacity-60" style={{ background: CCY_COLORS.USD }} />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Валюта</p>
              <p className="text-muted-foreground text-[10px]">{fxKeys.join(" · ") || "—"}</p>
            </div>
            <span className="tabular-nums font-medium shrink-0">{valPctV.toFixed(1).replace(".", ",")}%</span>
            <span className="tabular-nums text-muted-foreground shrink-0">{fmtCompact(valMoneyV, baseCurrency)}</span>
          </div>

          {/* Individual FX */}
          {fxKeys.map((k) => (
            <div key={k} className="flex items-center gap-2 py-0.5 pl-3">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: CCY_COLORS[k] }} />
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground">{CCY_NAMES[k]}</p>
                <p className="text-muted-foreground/60 text-[10px]">{k}</p>
              </div>
              <span className="tabular-nums text-muted-foreground shrink-0">{(ccyView[k]?.pct ?? 0).toFixed(1).replace(".", ",")}%</span>
              <span className="tabular-nums text-muted-foreground/70 shrink-0">{fmtCompact(ccyView[k]?.money ?? 0, baseCurrency)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
