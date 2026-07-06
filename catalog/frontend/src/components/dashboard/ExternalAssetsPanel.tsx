"use client";

import { Plus, X, Wallet } from "lucide-react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { ASSET_CLASSES } from "@/lib/types";
import type { ExternalAsset } from "@/lib/types";

const CURRENCIES = ["RUB", "USD", "CNY", "GLD"] as const;

export function ExternalAssetsPanel() {
  const s = usePortfolioStore();
  const list = s.external_assets;

  const update = (i: number, patch: Partial<ExternalAsset>) => {
    const next = list.map((a, j) => (j === i ? { ...a, ...patch } : a));
    s.set({ external_assets: next });
  };
  const add = () =>
    s.set({ external_assets: [...list, { name: "", amount: 0, currency: "RUB", asset_class: "equity" }] });
  const remove = (i: number) => s.set({ external_assets: list.filter((_, j) => j !== i) });

  return (
    <div className="glossy rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 ring-1 ring-primary/20 text-primary shrink-0">
            <Wallet className="w-3.5 h-3.5" strokeWidth={2} />
          </span>
          <h3 className="text-[15px] font-bold tracking-tight">Внешние активы клиента</h3>
        </div>
        <span className="text-[11px] text-muted-foreground">учитываются в совокупном портфеле</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4 max-w-2xl">
        Активы клиента вне нашей УК (недвижимость, депозиты, бумаги). Влияют на сводную аллокацию всего капитала.
      </p>

      {list.length === 0 ? (
        <button
          type="button"
          onClick={add}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Добавить внешний актив
        </button>
      ) : (
        <div className="space-y-2">
          {list.map((a, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 pb-2 border-b border-border/50 sm:border-0 sm:pb-0 sm:grid sm:grid-cols-[minmax(0,1fr)_120px_88px_140px_32px] sm:items-center"
            >
              <input
                value={a.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Название актива"
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1.2fr)_32px] gap-2 sm:contents">
                <input
                  type="text"
                  inputMode="numeric"
                  value={a.amount ? a.amount.toLocaleString("ru-RU") : ""}
                  onChange={(e) => update(i, { amount: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0 })}
                  placeholder="Сумма"
                  className="px-3 py-2 text-sm tabular-nums text-right rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/30 min-w-0"
                />
                <select
                  value={a.currency}
                  onChange={(e) => update(i, { currency: e.target.value })}
                  className="px-2 py-2 text-sm rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/30 min-w-0"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={a.asset_class}
                  onChange={(e) => update(i, { asset_class: e.target.value })}
                  className="px-2 py-2 text-sm rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-primary/30 min-w-0"
                >
                  {ASSET_CLASSES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Удалить"
                  className="flex items-center justify-center h-9 w-8 rounded-lg text-muted-foreground hover:text-[var(--neg)] hover:bg-[var(--neg)]/10 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1.5 mt-1 text-sm font-semibold text-primary hover:underline"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Ещё актив
          </button>
        </div>
      )}
    </div>
  );
}
