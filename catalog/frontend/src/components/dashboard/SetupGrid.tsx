"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { RISK_PROFILES, CCY_STRATEGIES, AMOUNT_CURRENCIES } from "@/lib/types";
import { CCY_LABEL, CCY_SYM } from "@/lib/format";
import { cn } from "@/lib/utils";

const RISK_TAG_CLS: Record<string, string> = {
  cons: "text-[var(--pos)]",
  base: "text-primary",
  agg:  "text-[var(--neg)]",
};

function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-md text-[12px] font-bold text-primary bg-primary/10 ring-1 ring-primary/20 shrink-0 tabular-nums">
        {n}
      </span>
      <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
    </div>
  );
}

function AmountInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value.toString());
  const fmt = new Intl.NumberFormat("ru-RU").format(value);

  return (
    <input
      type="text"
      inputMode="numeric"
      className="text-[1.75rem] font-extrabold tracking-tight bg-transparent outline-none w-full tabular-nums"
      value={editing ? raw : fmt}
      onFocus={(e) => { setEditing(true); setRaw(value.toString()); e.target.select(); }}
      onBlur={() => setEditing(false)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        setRaw(digits);
        onChange(Math.max(1, parseInt(digits, 10) || 1));
      }}
    />
  );
}

/** Selected-option visual: restrained accent fill + ring. */
const selectedCls =
  "border-transparent bg-primary/[0.07] ring-1 ring-primary/30";

export function SetupGrid() {
  const s = usePortfolioStore();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Amount */}
        <div className="glossy rounded-2xl p-5">
          <StepHeader n={1} title="Сумма инвестиций" />
          <div className="border border-input rounded-xl px-4 py-3 mb-3 flex items-center gap-2 focus-within:ring-2 focus-within:ring-primary/40 transition-shadow">
            <span className="text-xl font-bold text-muted-foreground/70">{CCY_SYM[s.amount_ccy]}</span>
            <AmountInput value={s.amount} onChange={(v) => s.set({ amount: v })} />
          </div>
          <div className="flex gap-2">
            {AMOUNT_CURRENCIES.map((c) => (
              <button type="button"
                key={c}
                onClick={() => s.set({ amount_ccy: c })}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-all font-semibold border",
                  s.amount_ccy === c
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {CCY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Card 2: Risk profile */}
        <div className="relative">
          {s.manual && (
            <p className="absolute top-3 right-4 z-10 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              ручной режим
            </p>
          )}
          <div className={cn(
            "glossy rounded-2xl p-5 transition-opacity",
            s.manual && "opacity-50 pointer-events-none",
          )}>
            <StepHeader n={2} title="Профиль клиента" />
            <div className="space-y-2">
              {Object.entries(RISK_PROFILES).map(([k, v]) => {
                const active = s.risk === k;
                return (
                  <button type="button"
                    key={k}
                    onClick={() => s.set({ risk: k })}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl border transition-all",
                      active ? selectedCls : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">{v.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                      </div>
                      <span className={cn("text-xs font-bold shrink-0 mt-0.5", RISK_TAG_CLS[k])}>
                        {v.tag}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 3: CCY strategy */}
        <div className={cn(
          "glossy rounded-2xl p-5 transition-opacity",
          (s.risk === "base" || s.manual) && "opacity-50",
          s.manual && "pointer-events-none",
        )}>
          <StepHeader n={3} title="Распределение валют" />
          <div className="space-y-2">
            {Object.entries(CCY_STRATEGIES).map(([k, v]) => {
              const active = s.ccy === k && s.risk !== "base";
              return (
                <button type="button"
                  key={k}
                  onClick={() => s.risk !== "base" && s.set({ ccy: k })}
                  disabled={s.risk === "base"}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border transition-all",
                    active ? selectedCls : "border-border hover:bg-muted/50 disabled:hover:bg-transparent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{v.name}</p>
                      <p className="text-xs text-muted-foreground">Рубль · Валюта</p>
                    </div>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-sm font-bold tabular-nums shrink-0",
                      active ? "text-primary" : "text-muted-foreground",
                    )}>
                      {v.rub} / {v.val}
                      {active && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
