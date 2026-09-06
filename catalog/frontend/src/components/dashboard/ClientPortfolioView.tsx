"use client";

import { fmtCompact, fmtFull } from "@/lib/format";
import { ASSET_CLASS_LABEL } from "@/lib/types";

const CCY_NAMES: Record<string, string> = { RUB: "Рубль", USD: "Доллар США", CNY: "Юань", GLD: "Золото" };
const CCY_ORDER = ["RUB", "USD", "CNY", "GLD"];
const CLASS_ORDER = ["equity", "bond", "alternative", "cash", "realty", "other"];

function Row({
  label, ourVal, extVal, grand, baseCurrency,
}: { label: string; ourVal: number; extVal: number; grand: number; baseCurrency: string }) {
  const total = ourVal + extVal;
  if (total <= 0) return null;
  const ourPct = grand > 0 ? (ourVal / grand) * 100 : 0;
  const extPct = grand > 0 ? (extVal / grand) * 100 : 0;
  const sharePct = grand > 0 ? (total / grand) * 100 : 0;
  return (
    <div className="py-1.5" title={`Наши фонды: ${fmtFull(ourVal, baseCurrency)} · Внешние: ${fmtFull(extVal, baseCurrency)}`}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {fmtCompact(total, baseCurrency)} · {sharePct.toFixed(1).replace(".", ",")}%
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
        <div className="bg-primary" style={{ width: `${ourPct}%` }} />
        <div className="bg-foreground/25" style={{ width: `${extPct}%` }} />
      </div>
    </div>
  );
}

export function ClientPortfolioView({
  investedBase,
  externalTotalBase,
  ourCurrency,
  ourClass,
  externalCurrency,
  externalClass,
  baseCurrency,
  adjusted,
}: {
  investedBase: number;
  externalTotalBase: number;
  ourCurrency: Record<string, number>;
  ourClass: Record<string, number>;
  externalCurrency: Record<string, number>;
  externalClass: Record<string, number>;
  baseCurrency: string;
  adjusted: boolean;
}) {
  if (externalTotalBase <= 0) return null;

  const grand = investedBase + externalTotalBase;
  const ourShare = grand > 0 ? (investedBase / grand) * 100 : 0;
  const extShare = grand > 0 ? (externalTotalBase / grand) * 100 : 0;

  const ccyKeys = [...new Set([...CCY_ORDER, ...Object.keys(ourCurrency), ...Object.keys(externalCurrency)])]
    .filter((k) => (ourCurrency[k] ?? 0) + (externalCurrency[k] ?? 0) > 0);
  const clsKeys = [...new Set([...CLASS_ORDER, ...Object.keys(ourClass), ...Object.keys(externalClass)])]
    .filter((k) => (ourClass[k] ?? 0) + (externalClass[k] ?? 0) > 0);

  return (
    <div className="glossy rounded-2xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Совокупный портфель клиента</p>
          <p className="text-2xl font-extrabold tabular-nums tracking-tight mt-1">{fmtCompact(grand, baseCurrency)}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
            Наши фонды · {ourShare.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-foreground/25" />
            Внешние · {extShare.toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground-2 mb-2">По валютам</p>
          {ccyKeys.map((k) => (
            <Row key={k} label={CCY_NAMES[k] ?? k} ourVal={ourCurrency[k] ?? 0} extVal={externalCurrency[k] ?? 0} grand={grand} baseCurrency={baseCurrency} />
          ))}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground-2 mb-2">По классам активов</p>
          {clsKeys.map((k) => (
            <Row key={k} label={ASSET_CLASS_LABEL[k] ?? k} ourVal={ourClass[k] ?? 0} extVal={externalClass[k] ?? 0} grand={grand} baseCurrency={baseCurrency} />
          ))}
        </div>
      </div>

      {adjusted && (
        <p className="mt-4 pt-3 border-t border-border/60 text-[11px] text-muted-foreground flex items-start gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary mt-1 shrink-0" />
          Аллокация наших фондов скорректирована под внешние активы клиента — целевой валютный микс стратегии достигнут на совокупном портфеле.
        </p>
      )}
    </div>
  );
}
