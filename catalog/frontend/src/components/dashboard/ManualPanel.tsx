"use client";

import { useMemo } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { FUND_META, FUND_KEYS, INDEX_LIST } from "@/lib/types";
import { cn } from "@/lib/utils";

function totalCls(total: number) {
  const ok = Math.abs(total - 100) < 0.05;
  return ok
    ? "bg-[var(--pos)]/12 text-[var(--pos)]"
    : "bg-[var(--neg)]/12 text-[var(--neg)]";
}

function fmtPct(v: number): string {
  return v.toFixed(1) + "%";
}

function clampPct(v: number): number {
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export function ManualPanel() {
  const s = usePortfolioStore();

  const setFund = (k: string, v: number) => {
    const next = { ...s.manual_funds, [k]: clampPct(v) };
    s.set({ manual_funds: next });
  };

  const fundsTotal = useMemo(
    () => FUND_KEYS.reduce((sum, k) => sum + (s.manual_funds[k] ?? 0), 0),
    [s.manual_funds],
  );

  const indexWeights = useMemo(() => {
    const out: Record<string, number> = {};
    INDEX_LIST.forEach((idx) => (out[idx.key] = 0));
    FUND_KEYS.forEach((k) => {
      const w = s.manual_funds[k] ?? 0;
      if (w > 0) {
        const b = FUND_META[k].benchmark;
        out[b] = (out[b] ?? 0) + w;
      }
    });
    return out;
  }, [s.manual_funds]);

  const idxTotal = useMemo(
    () => Object.values(indexWeights).reduce((a, b) => a + b, 0),
    [indexWeights],
  );

  return (
    <div className="glossy rounded-2xl p-5 space-y-4">
      <p className="text-sm text-muted-foreground max-w-3xl">
        Задайте доли фондов вручную. Доли композитного индекса пересобираются автоматически из бенчмарков фондов.
        Ручной режим переопределяет выбранную стратегию — кнопки риск-профиля и валютной стратегии станут неактивны.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Funds column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              Фонды
              <span className={cn("text-xs font-semibold tabular-nums px-2 py-0.5 rounded", totalCls(fundsTotal))}>
                {fmtPct(fundsTotal)}
              </span>
            </h4>
            <button type="button"
              onClick={() => s.resetManual()}
              className="text-xs px-2 py-1 border border-border rounded-md hover:bg-muted transition-colors"
            >
              Сбросить
            </button>
          </div>
          <div className="divide-y divide-border">
            {FUND_KEYS.map((k) => {
              const meta = FUND_META[k];
              const v = s.manual_funds[k] ?? 0;
              return (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_80px] gap-3 items-center py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{meta.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {k} · {meta.native_currency} · {meta.benchmark_label}
                    </p>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.5}
                    value={v}
                    onChange={(e) => setFund(k, parseFloat(e.target.value))}
                    className="accent-primary w-full"
                  />
                  <div className="flex items-center border border-input rounded-md px-2 py-1 bg-background">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={v}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value.replace(",", "."));
                        setFund(k, n);
                      }}
                      className="w-full bg-transparent outline-none text-sm tabular-nums text-right"
                    />
                    <span className="text-xs text-muted-foreground ml-1">%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Indices column (readonly, derived) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              Композитный индекс
              <span className={cn("text-xs font-semibold tabular-nums px-2 py-0.5 rounded", totalCls(idxTotal))}>
                {fmtPct(idxTotal)}
              </span>
            </h4>
            <span className="text-xs text-muted-foreground">рассчитывается автоматически</span>
          </div>
          <div className="divide-y divide-border">
            {INDEX_LIST.map((idx) => {
              const v = indexWeights[idx.key] ?? 0;
              return (
                <div key={idx.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_80px] gap-3 items-center py-2.5 opacity-80">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{idx.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{idx.sub}</p>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.5}
                    value={v}
                    disabled
                    tabIndex={-1}
                    className="accent-muted-foreground w-full cursor-not-allowed"
                  />
                  <div className="flex items-center border border-input rounded-md px-2 py-1 bg-muted/30">
                    <input
                      type="text"
                      value={v.toFixed(1)}
                      readOnly
                      tabIndex={-1}
                      className="w-full bg-transparent outline-none text-sm tabular-nums text-right text-muted-foreground"
                    />
                    <span className="text-xs text-muted-foreground ml-1">%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
