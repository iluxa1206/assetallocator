"use client";

import { useState } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { RISK_PROFILES, CCY_STRATEGIES, AMOUNT_CURRENCIES } from "@/lib/types";
import { CCY_LABEL, CCY_SYM } from "@/lib/format";
import { cn } from "@/lib/utils";

const RISK_TAG_CLS: Record<string, string> = {
  base: "text-muted-foreground",
  cons: "text-primary",
  agg:  "text-muted-foreground",
};

function AmountInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value.toString());
  const fmt = new Intl.NumberFormat("ru-RU").format(value);

  return (
    <input
      type="text"
      inputMode="numeric"
      className="text-3xl font-light tracking-tight bg-transparent outline-none w-full"
      value={editing ? raw : fmt}
      onFocus={(e) => { setEditing(true); setRaw(value.toString()); e.target.select(); }}
      onBlur={() => setEditing(false)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        setRaw(digits);
        onChange(parseInt(digits, 10) || 0);
      }}
    />
  );
}

export function SetupGrid() {
  const s = usePortfolioStore();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Amount */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">ШАГ 1</span>
            <span className="text-xs font-semibold text-muted-foreground">01</span>
          </div>
          <h3 className="text-base font-semibold mb-4">Сумма инвестиций</h3>
          <div className="border border-input rounded-xl px-4 py-3 mb-3">
            <AmountInput value={s.amount} onChange={(v) => s.set({ amount: v })} />
          </div>
          <div className="flex gap-2 mb-3">
            {AMOUNT_CURRENCIES.map((c) => (
              <button type="button"
                key={c}
                onClick={() => s.set({ amount_ccy: c })}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg transition-colors border",
                  s.amount_ccy === c
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {CCY_LABEL[c]}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {new Intl.NumberFormat("ru-RU").format(s.amount)} {CCY_SYM[s.amount_ccy]}
          </p>
        </div>

        {/* Card 2: Risk profile */}
        <div className={cn(
          "bg-card border border-border rounded-2xl p-5 transition-opacity",
          s.manual && "opacity-50 pointer-events-none",
        )}>
          {s.manual && (
            <p className="absolute -mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">ручной режим</p>
          )}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">ШАГ 2 · РИСК-ПРОФИЛЬ</span>
            <span className="text-xs font-semibold text-muted-foreground">02</span>
          </div>
          <h3 className="text-base font-semibold mb-4">Профиль клиента</h3>
          <div className="space-y-2">
            {Object.entries(RISK_PROFILES).map(([k, v]) => (
              <button type="button"
                key={k}
                onClick={() => s.set({ risk: k })}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border transition-colors",
                  s.risk === k
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                  </div>
                  <span className={cn("text-xs font-medium shrink-0 mt-0.5", RISK_TAG_CLS[k])}>
                    {v.tag}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Card 3: CCY strategy */}
        <div className={cn(
          "bg-card border border-border rounded-2xl p-5 transition-opacity",
          (s.risk === "base" || s.manual) && "opacity-50",
          s.manual && "pointer-events-none",
        )}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">ШАГ 3 · ВАЛЮТНАЯ СТРАТЕГИЯ</span>
            <span className="text-xs font-semibold text-muted-foreground">03</span>
          </div>
          <h3 className="text-base font-semibold mb-4">Распределение валют</h3>
          <div className="space-y-2">
            {Object.entries(CCY_STRATEGIES).map(([k, v]) => (
              <button type="button"
                key={k}
                onClick={() => s.risk !== "base" && s.set({ ccy: k })}
                disabled={s.risk === "base"}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border transition-colors",
                  s.ccy === k && s.risk !== "base"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50 disabled:hover:bg-transparent"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">Рубль · Валюта</p>
                  </div>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums shrink-0",
                    s.ccy === k && s.risk !== "base" ? "text-primary" : "text-muted-foreground"
                  )}>
                    {v.rub} / {v.val}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
