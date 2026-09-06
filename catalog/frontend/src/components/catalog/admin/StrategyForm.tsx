"use client";

/**
 * Single-component Strategy editor — used by /strategies/new and /strategies/[code]/edit.
 *
 * Mirrors FundForm: plain useState over the Pydantic shape, server-side validation via 422.
 * Composition is edited as a per-fund weight grid (weight 0 = excluded); only positive
 * weights are saved. `inception_date` drives the backtest start on the detail page.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, X, Trash2 } from "lucide-react";
import { createStrategy, deleteStrategy, updateStrategy, fetchFunds } from "@/lib/api";
import type { Strategy } from "@/lib/types";
import { cn } from "@/lib/utils";

const RISK_PROFILES = [
  { key: "base", label: "Базовый" },
  { key: "cons", label: "Консервативный" },
  { key: "agg", label: "Агрессивный" },
];

const CCY_STRATEGIES = [
  { key: "none", label: "— (без валютной стратегии)" },
  { key: "rub6040", label: "Рубль 60 / Валюта 40" },
  { key: "equal", label: "Поровну 50 / 50" },
  { key: "val6040", label: "Валюта 60 / Рубль 40" },
];

interface Props {
  /** Existing strategy — undefined when creating new */
  initial: Strategy | undefined;
  /** Whether the `code` field is editable (only on /new) */
  isNew: boolean;
}

function blankStrategy(): Partial<Strategy> {
  return {
    code: "",
    name: "",
    risk_profile: "base",
    ccy_strategy: "none",
    description: null,
    composition: {},
    inception_date: null,
    target_yield: null,
    horizon: null,
    min_check: null,
    rebalance_period: null,
    sort_order: 0,
    is_active: true,
  };
}

export function StrategyForm({ initial, isNew }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [data, setData] = useState<Partial<Strategy>>(initial ? { ...initial } : blankStrategy());
  const [error, setError] = useState<string | null>(null);

  const { data: funds } = useQuery({ queryKey: ["funds"], queryFn: () => fetchFunds() });

  const patch = <K extends keyof Strategy>(field: K, value: Strategy[K] | null) =>
    setData((d) => ({ ...d, [field]: value }));

  const comp = data.composition ?? {};
  const setWeight = (key: string, w: number) =>
    setData((d) => {
      const next = { ...(d.composition ?? {}) };
      if (w > 0) next[key] = w;
      else delete next[key];
      return { ...d, composition: next };
    });
  const total = Object.values(comp).reduce((a, b) => a + (b || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Strip zero/empty weights before sending.
      const cleanComp = Object.fromEntries(
        Object.entries(data.composition ?? {}).filter(([, w]) => w && w > 0),
      );
      const payload = { ...data, composition: cleanComp };
      if (isNew) return createStrategy(payload as Strategy);
      return updateStrategy(data.code!, payload);
    },
    onSuccess: (strat) => {
      qc.invalidateQueries({ queryKey: ["strategies"] });
      qc.invalidateQueries({ queryKey: ["strategy", strat.code] });
      qc.invalidateQueries({ queryKey: ["strategy-series", strat.code] });
      router.push(`/catalog/strategies/${strat.code}`);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStrategy(data.code!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["strategies"] });
      router.push("/catalog/strategies");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    saveMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-background/95 backdrop-blur border-b border-border flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {isNew ? "Новая стратегия" : `Редактирование · ${data.name}`}
        </h2>
        <div className="flex gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Деактивировать стратегию ${data.code}? (soft-delete, можно восстановить)`)) {
                  deleteMutation.mutate();
                }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/20"
            >
              <Trash2 className="h-4 w-4" /> Деактивировать
            </button>
          )}
          <Link
            href={isNew ? "/catalog/strategies" : `/catalog/strategies/${data.code}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent"
          >
            <X className="h-4 w-4" /> Отмена
          </Link>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saveMutation.isPending ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Section: Basic */}
      <Section title="Основное">
        <Grid>
          <Field label="Код (code)" hint={isNew ? "Уникальный идентификатор, латиница (напр. cons-rub6040)" : "Иммутабелен после создания"}>
            <input
              required
              disabled={!isNew}
              value={data.code ?? ""}
              onChange={(e) => patch("code", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Sort order" hint="Меньше — выше в списке">
            <input
              type="number"
              value={data.sort_order ?? 0}
              onChange={(e) => patch("sort_order", parseInt(e.target.value) || 0)}
              className={inputCls}
            />
          </Field>

          <Field label="Название" required>
            <input required value={data.name ?? ""} onChange={(e) => patch("name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Дата запуска" hint="Старт бэктеста на странице стратегии">
            <input
              type="date"
              value={data.inception_date ?? ""}
              onChange={(e) => patch("inception_date", e.target.value || null)}
              className={inputCls}
            />
          </Field>

          <Field label="Риск-профиль" required>
            <select value={data.risk_profile ?? "base"} onChange={(e) => patch("risk_profile", e.target.value)} className={inputCls}>
              {RISK_PROFILES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Валютная стратегия" required>
            <select value={data.ccy_strategy ?? "none"} onChange={(e) => patch("ccy_strategy", e.target.value)} className={inputCls}>
              {CCY_STRATEGIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>

          <Field label="Целевая доходность">
            <input value={data.target_yield ?? ""} onChange={(e) => patch("target_yield", e.target.value || null)} className={inputCls} />
          </Field>
          <Field label="Горизонт">
            <input value={data.horizon ?? ""} onChange={(e) => patch("horizon", e.target.value || null)} className={inputCls} />
          </Field>

          <Field label="Мин. чек">
            <input value={data.min_check ?? ""} onChange={(e) => patch("min_check", e.target.value || null)} className={inputCls} />
          </Field>
          <Field label="Ребалансировка">
            <input value={data.rebalance_period ?? ""} onChange={(e) => patch("rebalance_period", e.target.value || null)} className={inputCls} />
          </Field>

          <Field label="Active">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.is_active ?? true}
                onChange={(e) => patch("is_active", e.target.checked)}
              />
              Стратегия видима в каталоге
            </label>
          </Field>
        </Grid>
      </Section>

      {/* Section: Description */}
      <Section title="Описание">
        <textarea
          rows={5}
          value={data.description ?? ""}
          onChange={(e) => patch("description", e.target.value || null)}
          className={cn(inputCls, "resize-y")}
        />
      </Section>

      {/* Section: Composition */}
      <Section title="Состав портфеля">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Вес каждого фонда, %. 0 — исключить из портфеля.</span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              Math.abs(total - 100) < 0.01 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
            )}
          >
            Сумма: {total}%
          </span>
        </div>
        <div className="rounded-xl border border-border divide-y divide-border">
          {(funds ?? []).map((f) => (
            <div key={f.key} className="flex items-center gap-3 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.short_name ?? f.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {f.key} · {f.native_currency}
                </div>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                value={comp[f.key] ?? ""}
                onChange={(e) => setWeight(f.key, e.target.value === "" ? 0 : parseFloat(e.target.value) || 0)}
                placeholder="0"
                className={cn(inputCls, "w-24 text-right")}
              />
              <span className="text-xs text-muted-foreground w-3">%</span>
            </div>
          ))}
          {(!funds || funds.length === 0) && (
            <div className="px-3 py-4 text-sm text-muted-foreground">Загрузка фондов…</div>
          )}
        </div>
      </Section>
    </form>
  );
}

// ──────────────── helpers ────────────────

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-border bg-card p-5 space-y-3">
      <legend className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2", className)}>{children}</div>;
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground-2">{hint}</span>}
    </label>
  );
}
