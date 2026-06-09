"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Layers, Shield, Flame, type LucideIcon } from "lucide-react";
import { fetchStrategies, fetchFunds, fetchMe } from "@/lib/api";
import type { Fund, Strategy } from "@/lib/types";
import { cn } from "@/lib/utils";

const RISK_META: Record<string, { label: string; Icon: LucideIcon; tone: string }> = {
  base: {
    label: "Базовый",
    Icon: Layers,
    tone: "border-slate-300/70 bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-background dark:border-slate-700",
  },
  cons: {
    label: "Консервативный",
    Icon: Shield,
    tone: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-background dark:border-emerald-900",
  },
  agg: {
    label: "Агрессивный",
    Icon: Flame,
    tone: "border-rose-200 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 dark:to-background dark:border-rose-900",
  },
};

const CCY_LABEL: Record<string, string> = {
  rub6040: "₽ 60 / Валюта 40",
  equal: "50 / 50",
  val6040: "₽ 40 / Валюта 60",
  none: "—",
};

function fundCcy(key: string, funds: Fund[] | undefined): string {
  return funds?.find((x) => x.key === key)?.native_currency ?? "";
}

/** Currency allocation bar — split by RUB vs FX from composition. */
function CcyAllocBar({ comp, funds }: { comp: Record<string, number>; funds: Fund[] | undefined }) {
  let rub = 0;
  let fx = 0;
  for (const [k, w] of Object.entries(comp)) {
    if (w <= 0) continue;
    if (fundCcy(k, funds) === "RUB") rub += w;
    else fx += w;
  }
  const total = rub + fx || 1;
  const rubPct = (rub / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
        <span>Валютная аллокация</span>
        <span className="tabular-nums">
          {Math.round(rubPct)}% / {Math.round(100 - rubPct)}%
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden ring-1 ring-border/70">
        <div className="bg-blue-500/80 dark:bg-blue-400/80" style={{ width: `${rubPct}%` }} />
        <div className="bg-indigo-500/80 dark:bg-indigo-400/80" style={{ width: `${100 - rubPct}%` }} />
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> ₽ RUB
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> FX
        </span>
      </div>
    </div>
  );
}

function StrategyHeroCard({ s, funds }: { s: Strategy; funds: Fund[] | undefined }) {
  const meta = RISK_META[s.risk_profile] ?? RISK_META.base;
  const Icon = meta.Icon;
  const nFunds = Object.values(s.composition).filter((w) => w > 0).length;

  return (
    <Link
      href={`/catalog/strategies/${s.code}`}
      className={cn(
        "group flex flex-col aspect-[4/3] rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5",
        meta.tone,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground min-w-0">
          <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
          <span className="truncate">{meta.label}</span>
          {s.ccy_strategy !== "none" && (
            <span className="text-border shrink-0">·</span>
          )}
          {s.ccy_strategy !== "none" && (
            <span className="tabular-nums truncate">{CCY_LABEL[s.ccy_strategy] ?? s.ccy_strategy}</span>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold tabular-nums leading-none">{nFunds}</div>
          <div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground mt-0.5">фондов</div>
        </div>
      </div>

      <h3 className="mt-2 text-base font-semibold tracking-tight leading-snug line-clamp-2">{s.name}</h3>

      {s.description && (
        <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2 leading-snug">{s.description}</p>
      )}

      {/* Currency bar — fills middle */}
      <div className="mt-auto pt-3">
        <CcyAllocBar comp={s.composition} funds={funds} />
      </div>
    </Link>
  );
}

export default function StrategiesListPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["strategies"],
    queryFn: () => fetchStrategies(),
  });
  const { data: funds } = useQuery({ queryKey: ["funds"], queryFn: () => fetchFunds() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка…</div>;
  if (isError || !data) return <div className="text-destructive text-sm">Не удалось загрузить стратегии</div>;

  const groups = new Map<string, Strategy[]>();
  for (const s of data) {
    if (!groups.has(s.risk_profile)) groups.set(s.risk_profile, []);
    groups.get(s.risk_profile)!.push(s);
  }
  const order = ["base", "cons", "agg"].filter((r) => groups.has(r));

  return (
    <div className="space-y-10">
      {me?.is_superuser && (
        <div className="flex justify-end">
          <Link
            href="/catalog/strategies/new"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            + Добавить стратегию
          </Link>
        </div>
      )}

      {order.map((rp) => {
        const meta = RISK_META[rp] ?? { label: rp, Icon: Layers };
        const Icon = meta.Icon;
        return (
          <section key={rp} className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {meta.label}
              <span className="text-border">·</span>
              <span className="text-muted-foreground/60 normal-case tracking-normal">
                {groups.get(rp)!.length} стратеги{groups.get(rp)!.length === 1 ? "я" : groups.get(rp)!.length < 5 ? "и" : "й"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {groups.get(rp)!.map((s) => (
                <StrategyHeroCard key={s.code} s={s} funds={funds} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
