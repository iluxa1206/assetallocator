"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, ChevronRight } from "lucide-react";
import {
  fetchCompetitorLeaderboard,
  fetchMe,
  fetchPeerGroups,
  isRestrictedUser,
  type CatalogRange,
  type CompetitorRow,
} from "@/lib/api";
import { Sparkline } from "@/components/catalog/Sparkline";
import { PeriodSwitcher, RANGE_RETURN_LABEL_SHORT } from "@/components/catalog/PeriodSwitcher";
import { CompetitorOverlayChart } from "@/components/competitors/CompetitorOverlayChart";
import { MonthlyPanel } from "@/components/competitors/MonthlyPanel";
import { fmtPct, fmtPctSimple } from "@/lib/format";
import { cn } from "@/lib/utils";

// peer_group → human label
const PEER_LABEL: Record<string, string> = {
  corp_rub: "Корп. облигации",
  ofz: "ОФЗ / гособлигации",
  money: "Денежный рынок",
};

type SortKey = "ret" | "cagr" | "vol" | "max_dd" | "sharpe" | "name";

const COLS: { key: SortKey; label: string; hint: string }[] = [
  { key: "cagr", label: "CAGR", hint: "Среднегодовая доходность за период" },
  { key: "vol", label: "Волат.", hint: "Годовая волатильность" },
  { key: "max_dd", label: "Просад.", hint: "Максимальная просадка" },
  { key: "sharpe", label: "Sharpe", hint: "Доходность на единицу риска (rf=0)" },
];

function KindBadge({ kind }: { kind: CompetitorRow["kind"] }) {
  if (kind === "own")
    return <span className="text-[9px] uppercase tracking-wider bg-primary/15 text-primary px-1.5 py-0.5 rounded">Наш</span>;
  if (kind === "benchmark")
    return <span className="text-[9px] uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Индекс</span>;
  return null;
}

export default function CompetitorsPage() {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  useEffect(() => {
    if (isRestrictedUser(me)) router.replace("/dashboard");
  }, [me, router]);

  const [range, setRange] = useState<CatalogRange>("12m");
  const [peer, setPeer] = useState<string | "all">("all");
  const [includeOwn, setIncludeOwn] = useState(true);
  const [sort, setSort] = useState<SortKey>("ret");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const { data: peerGroups } = useQuery({
    queryKey: ["competitor-peer-groups"],
    queryFn: fetchPeerGroups,
  });

  const { data: rows, isLoading, isError } = useQuery({
    queryKey: ["competitor-leaderboard", range, peer, includeOwn],
    queryFn: () =>
      fetchCompetitorLeaderboard({
        range,
        peer_group: peer === "all" ? undefined : peer,
        include_own: includeOwn,
      }),
  });

  const onSort = (k: SortKey) => {
    if (sort === k) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    if (!rows) return [];
    const mul = sortDir === "desc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let base: number;
      if (sort === "name") base = (b.short_name ?? b.name).localeCompare(a.short_name ?? a.name, "ru");
      else {
        const va = (a[sort] as number | null) ?? -Infinity;
        const vb = (b[sort] as number | null) ?? -Infinity;
        base = vb - va;
      }
      return base * mul;
    });
  }, [rows, sort, sortDir]);

  // Default overlay selection: top 4 by current sort (once data lands).
  const effectiveSelected = useMemo(() => {
    if (selected) return selected;
    return new Set(sorted.slice(0, 4).map((r) => r.key));
  }, [selected, sorted]);

  const toggle = (key: string) => {
    const next = new Set(effectiveSelected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const overlayRows = sorted.filter((r) => effectiveSelected.has(r.key));
  const retLabel = RANGE_RETURN_LABEL_SHORT[range];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Конкуренты</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Сравнение динамики облигационных фондов конкурентов и рыночных индексов.
          </p>
        </div>
        <PeriodSwitcher value={range} onChange={setRange} />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPeer("all")}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
            peer === "all"
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Все стратегии
        </button>
        {(peerGroups ?? []).map((pg) => (
          <button
            key={pg}
            type="button"
            onClick={() => setPeer(pg)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              peer === pg
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {PEER_LABEL[pg] ?? pg}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeOwn}
            onChange={(e) => setIncludeOwn(e.target.checked)}
            className="accent-primary"
          />
          Показать наши фонды
        </label>
      </div>

      {/* ── States ── */}
      {isLoading && (
        <div className="space-y-2 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted" />
          ))}
        </div>
      )}
      {isError && <div className="text-destructive text-sm">Не удалось загрузить рейтинг</div>}

      {rows && !isLoading && (
        <>
          {/* ── Leaderboard table ── */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="w-8 px-3 py-2.5"></th>
                  <th
                    className="text-left px-3 py-2.5 font-medium cursor-pointer hover:text-foreground"
                    onClick={() => onSort("name")}
                  >
                    Фонд
                  </th>
                  <th
                    className="text-right px-3 py-2.5 font-medium cursor-pointer hover:text-foreground whitespace-nowrap"
                    onClick={() => onSort("ret")}
                    title={`Доходность за ${retLabel}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {retLabel}
                      {sort === "ret" && (sortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
                    </span>
                  </th>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      className="text-right px-3 py-2.5 font-medium cursor-pointer hover:text-foreground whitespace-nowrap"
                      onClick={() => onSort(c.key)}
                      title={c.hint}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sort === c.key && (sortDir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
                      </span>
                    </th>
                  ))}
                  <th className="text-right px-3 py-2.5 font-medium">Динамика</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const tone = (r.ret ?? 0) >= 0 ? "up" : "down";
                  const isSel = effectiveSelected.has(r.key);
                  const isOpen = expanded.has(r.key);
                  return (
                    <Fragment key={r.key}>
                    <tr
                      className={cn(
                        "border-b border-border/60 transition-colors hover:bg-muted/40",
                        isOpen && "border-b-0",
                        r.kind === "own" && "bg-primary/[0.04]",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(r.key)}
                          className="accent-primary"
                          aria-label={`Добавить ${r.name} на график`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleExpand(r.key)}
                          className="flex items-start gap-1.5 text-left group"
                          aria-expanded={isOpen}
                          title="Показать помесячные данные"
                        >
                          <ChevronRight
                            className={cn(
                              "w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground transition-transform",
                              isOpen && "rotate-90",
                            )}
                          />
                          <span>
                            <span className="flex items-center gap-2">
                              <span className="font-medium group-hover:text-primary transition-colors">
                                {r.short_name || r.name}
                              </span>
                              <KindBadge kind={r.kind} />
                            </span>
                            {r.provider && (
                              <span className="block text-[11px] text-muted-foreground mt-0.5">{r.provider}</span>
                            )}
                          </span>
                        </button>
                      </td>
                      <td
                        className={cn(
                          "text-right px-3 py-2.5 tabular-nums font-semibold whitespace-nowrap",
                          r.ret == null ? "text-muted-foreground" : tone === "up" ? "text-[var(--pos)]" : "text-[var(--neg)]",
                        )}
                      >
                        {fmtPct(r.ret)}
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums whitespace-nowrap">{fmtPctSimple(r.cagr ?? null)}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums whitespace-nowrap text-muted-foreground">{fmtPctSimple(r.vol ?? null)}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums whitespace-nowrap text-[var(--neg)]">{fmtPctSimple(r.max_dd ?? null)}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums whitespace-nowrap">{r.sharpe == null ? "—" : r.sharpe.toFixed(2).replace(".", ",")}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end">
                          <Sparkline points={r.points} tone={tone} width={110} height={32} />
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border/60">
                        <td colSpan={8} className="p-0">
                          <MonthlyPanel fundKey={r.key} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Overlay chart ── */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">Сравнение динамики (норм. к 100)</h2>
              <span className="text-xs text-muted-foreground">{overlayRows.length} выбрано</span>
            </div>
            <CompetitorOverlayChart rows={overlayRows} />
          </div>
        </>
      )}
    </div>
  );
}
