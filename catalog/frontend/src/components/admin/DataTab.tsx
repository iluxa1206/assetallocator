"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { syncCompetitors, syncMarketData, syncOwnFunds } from "@/lib/api";
import { cn } from "@/lib/utils";

type Outcome = { ok: boolean; text: string };

/** Ручной запуск синков котировок — то же, что делают джобы планировщика. */
export function DataTab() {
  const [ownResult, setOwnResult] = useState<Outcome | null>(null);
  const [compResult, setCompResult] = useState<Outcome | null>(null);
  const [marketResult, setMarketResult] = useState<Outcome | null>(null);

  const own = useMutation({
    mutationFn: () => syncOwnFunds(false),
    onSuccess: (r) => {
      const failed = r.failed.length ? ` · не удалось: ${r.failed.join(", ")}` : "";
      setOwnResult({
        ok: r.failed.length === 0,
        text: r.inserted
          ? `Добавлено котировок: ${r.inserted}${failed}`
          : `Новых котировок нет — данные уже актуальны${failed}`,
      });
    },
    onError: () => setOwnResult({ ok: false, text: "Не удалось обновить. Попробуйте позже." }),
  });

  const competitors = useMutation({
    mutationFn: () => syncCompetitors(false),
    onSuccess: (r) => {
      const inserted = Object.values(r).filter((n) => n > 0).reduce((a, b) => a + b, 0);
      const failed = Object.entries(r).filter(([, n]) => n < 0).map(([k]) => k);
      setCompResult({
        ok: failed.length === 0,
        text: inserted
          ? `Добавлено котировок: ${inserted}${failed.length ? ` · не удалось: ${failed.join(", ")}` : ""}`
          : `Новых котировок нет — данные уже актуальны${failed.length ? ` · не удалось: ${failed.join(", ")}` : ""}`,
      });
    },
    onError: () => setCompResult({ ok: false, text: "Не удалось обновить. Попробуйте позже." }),
  });

  const market = useMutation({
    mutationFn: () => syncMarketData(),
    onSuccess: (r) =>
      setMarketResult({
        ok: true,
        text: r.total
          ? `Записано значений: ${r.total} (${Object.keys(r.written).join(", ")})`
          : "Новых данных нет — ряды уже актуальны",
      }),
    onError: () => setMarketResult({ ok: false, text: "Не удалось обновить. Попробуйте позже." }),
  });

  return (
    <div className="space-y-4">
      <SyncCard
        title="Индексы и курсы валют"
        description="RGBITR, MCFTR, RUCNYTR, золото и курсы USD/CNY с MOEX, плюс индекс денежного рынка из ставки RUSFAR. Автоматически — ежедневно в 06:15 UTC."
        note="Cbonds ЗО и инфляция (CPI) сюда не входят: источники платные либо ручные, эти ряды по-прежнему из xlsx. От свежести этой таблицы зависит глубина истории на дашборде."
        busy={market.isPending}
        result={marketResult}
        onRun={() => {
          setMarketResult(null);
          market.mutate();
        }}
      />
      <SyncCard
        title="Котировки своих фондов"
        description="Цена пая с investfunds по семи ИПИФ, в рублях и в валюте фонда. Автоматически — по понедельникам в 06:45 UTC."
        note="ВО и М3 на investfunds недоступны — их котировки вводятся вручную."
        busy={own.isPending}
        result={ownResult}
        onRun={() => {
          setOwnResult(null);
          own.mutate();
        }}
      />
      <SyncCard
        title="Котировки конкурентов и бенчмарков"
        description="17 рядов с MOEX ISS и investfunds. Автоматически — ежедневно в 06:30 UTC."
        busy={competitors.isPending}
        result={compResult}
        onRun={() => {
          setCompResult(null);
          competitors.mutate();
        }}
      />
    </div>
  );
}

function SyncCard({
  title,
  description,
  note,
  busy,
  result,
  onRun,
}: {
  title: string;
  description: string;
  note?: string;
  busy: boolean;
  result: Outcome | null;
  onRun: () => void;
}) {
  return (
    <div className="glossy rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{description}</p>
          {note && <p className="text-[11px] text-muted-foreground-2 mt-1.5 max-w-xl">{note}</p>}
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-2 shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold",
            "bg-primary text-primary-foreground transition-colors hover:bg-primary/90",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          )}
        >
          <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} strokeWidth={2} />
          {busy ? "Обновляем…" : "Обновить"}
        </button>
      </div>

      {result && (
        <p
          role="status"
          className={cn(
            "mt-3 rounded-lg px-3 py-2 text-sm",
            result.ok
              ? "bg-[var(--pos)]/10 text-[var(--pos)]"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
