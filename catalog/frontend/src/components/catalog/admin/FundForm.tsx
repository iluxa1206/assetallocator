"use client";

/**
 * Single-component Fund editor — used both for /new and /[key]/edit.
 *
 * State is plain useState + JSON-mirroring the Pydantic schema. No react-hook-form
 * to keep deps minimal; validation is server-side via 422 from POST/PATCH.
 *
 * Sections:
 *   Basic / Manager / Params / Access / Texts / Why bullets /
 *   Fee tiers / Redemption / Risks / Top positions / Documents
 *
 * NAV quotes live in <QuotesEditor/> (only rendered on `/edit` — needs an existing fund).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, X, Trash2, Plus } from "lucide-react";
import { createFund, deleteFund, updateFund } from "@/lib/api";
import type {
  Fund,
  MgmtFeeTier,
  RiskItem,
  TopPosition,
  DocLink,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITIES = ["Минимальный", "Низкий", "Средний", "Высокий"];
const CATEGORIES = ["equities", "bonds", "alternative", "liquidity", "advisory"];
const CONTRACT_TYPES = ["ИПИФ", "ДУ", "Advisory"];
const CURRENCIES = ["RUB", "USD", "CNY", "GLD"];
const INVESTOR_TYPES = ["Квал", "Неквал"];

interface Props {
  /** Existing fund — undefined when creating new */
  initial: Fund | undefined;
  /** Whether the `key` field is editable (only on /new) */
  isNew: boolean;
}

function blankFund(): Partial<Fund> {
  return {
    key: "",
    name: "",
    short_name: "",
    category: "alternative",
    contract_type: "ИПИФ",
    native_currency: "RUB",
    benchmark: "",
    benchmark_label: "",
    isin: null,
    ticker: null,
    inception_date: null,
    fund_rules_no: null,
    aum: null,
    aum_currency: "RUB",
    aum_as_of: null,
    manager_name: null,
    manager_bio: null,
    target_yield: null,
    horizon: null,
    risk_score: 3,
    liquidity_label: null,
    interval_label: null,
    investor_type_fl: "Квал",
    investor_type_ul: "Квал",
    min_check: null,
    logistics: null,
    strategy_goal: null,
    description: null,
    why_bullets: [],
    mgmt_fee_tiers: [],
    redemption_discount_y1: 0,
    redemption_discount_y2: 0,
    extra_expenses: null,
    hwm: false,
    risks: [],
    top_positions: [],
    top_positions_as_of: null,
    documents: [],
    sort_order: 0,
    is_active: true,
  };
}

export function FundForm({ initial, isNew }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [data, setData] = useState<Partial<Fund>>(initial ? { ...initial } : blankFund());
  const [error, setError] = useState<string | null>(null);

  const patch = <K extends keyof Fund>(field: K, value: Fund[K] | null) =>
    setData((d) => ({ ...d, [field]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return createFund(data as Fund);
      }
      return updateFund(data.key!, data);
    },
    onSuccess: (fund) => {
      qc.invalidateQueries({ queryKey: ["funds"] });
      qc.invalidateQueries({ queryKey: ["fund", fund.key] });
      router.push(`/catalog/funds/${fund.key}`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Ошибка сохранения";
      setError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFund(data.key!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funds"] });
      router.push("/catalog");
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
          {isNew ? "Новый фонд" : `Редактирование · ${data.short_name ?? data.name}`}
        </h2>
        <div className="flex gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Деактивировать фонд ${data.key}? (soft-delete, можно восстановить)`)) {
                  deleteMutation.mutate();
                }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-300"
            >
              <Trash2 className="h-4 w-4" /> Деактивировать
            </button>
          )}
          <Link
            href={isNew ? "/catalog" : `/catalog/funds/${data.key}`}
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
        <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Section: Basic */}
      <Section title="Основное">
        <Grid>
          <Field label="Ключ (key)" hint={isNew ? "Уникальный идентификатор, латиница" : "Иммутабелен после создания"}>
            <input
              required
              disabled={!isNew}
              value={data.key ?? ""}
              onChange={(e) => patch("key", e.target.value)}
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

          <Field label="Полное название" required>
            <input required value={data.name ?? ""} onChange={(e) => patch("name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Короткое название (для карточек)">
            <input value={data.short_name ?? ""} onChange={(e) => patch("short_name", e.target.value || null)} className={inputCls} />
          </Field>

          <Field label="Категория">
            <select value={data.category ?? ""} onChange={(e) => patch("category", e.target.value || null)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Тип договора">
            <select value={data.contract_type ?? ""} onChange={(e) => patch("contract_type", e.target.value || null)} className={inputCls}>
              {CONTRACT_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Валюта" required>
            <select value={data.native_currency ?? "RUB"} onChange={(e) => patch("native_currency", e.target.value)} className={inputCls}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Бенчмарк (код)" required hint="RGBITR | MCFTR | CbondsZO_USD | CbondsZO_RUB | RUCNYTR_RUB | GLDRUB | RUSFAR">
            <input required value={data.benchmark ?? ""} onChange={(e) => patch("benchmark", e.target.value)} className={inputCls} />
          </Field>

          <Field label="Бенчмарк (подпись)">
            <input value={data.benchmark_label ?? ""} onChange={(e) => patch("benchmark_label", e.target.value)} className={inputCls} />
          </Field>
          <Field label="ISIN">
            <input value={data.isin ?? ""} onChange={(e) => patch("isin", e.target.value || null)} className={inputCls} />
          </Field>

          <Field label="Тикер МосБиржи">
            <input value={data.ticker ?? ""} onChange={(e) => patch("ticker", e.target.value || null)} className={inputCls} />
          </Field>
          <Field label="Дата запуска">
            <input
              type="date"
              value={data.inception_date ?? ""}
              onChange={(e) => patch("inception_date", e.target.value || null)}
              className={inputCls}
            />
          </Field>

          <Field label="№ правил фонда" hint="Например: №&nbsp;4853-СД от 21.02.2022">
            <input value={data.fund_rules_no ?? ""} onChange={(e) => patch("fund_rules_no", e.target.value || null)} className={inputCls} />
          </Field>
          <Field label="AUM (СЧА)" hint="Число в валюте AUM, без разделителей">
            <input
              type="number"
              step="any"
              value={data.aum ?? ""}
              onChange={(e) => patch("aum", e.target.value === "" ? null : parseFloat(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Валюта AUM">
            <select value={data.aum_currency ?? "RUB"} onChange={(e) => patch("aum_currency", e.target.value)} className={inputCls}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="AUM на дату">
            <input
              type="date"
              value={data.aum_as_of ?? ""}
              onChange={(e) => patch("aum_as_of", e.target.value || null)}
              className={inputCls}
            />
          </Field>
          <Field label="Active">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.is_active ?? true}
                onChange={(e) => patch("is_active", e.target.checked)}
              />
              Фонд видим в каталоге
            </label>
          </Field>
        </Grid>
      </Section>

      {/* Section: Manager */}
      <Section title="Управляющий">
        <Grid>
          <Field label="ФИО управляющего">
            <input value={data.manager_name ?? ""} onChange={(e) => patch("manager_name", e.target.value || null)} className={inputCls} />
          </Field>
          <Field label="Биография">
            <textarea
              rows={3}
              value={data.manager_bio ?? ""}
              onChange={(e) => patch("manager_bio", e.target.value || null)}
              className={cn(inputCls, "resize-y")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Section: Investment params */}
      <Section title="Параметры">
        <Grid>
          <Field label="Целевая доходность" hint='например "25-30% (net)"'>
            <input value={data.target_yield ?? ""} onChange={(e) => patch("target_yield", e.target.value || null)} className={inputCls} />
          </Field>
          <Field label="Горизонт">
            <input value={data.horizon ?? ""} onChange={(e) => patch("horizon", e.target.value || null)} className={inputCls} />
          </Field>

          <Field label="Риск-скейл (1-5)">
            <input
              type="number" min={1} max={5}
              value={data.risk_score ?? ""}
              onChange={(e) => patch("risk_score", parseInt(e.target.value) || null)}
              className={inputCls}
            />
          </Field>
          <Field label="Ликвидность" hint="Высокая | Ежемесячная | …">
            <input value={data.liquidity_label ?? ""} onChange={(e) => patch("liquidity_label", e.target.value || null)} className={inputCls} />
          </Field>

          <Field label="Интервал погашения">
            <input value={data.interval_label ?? ""} onChange={(e) => patch("interval_label", e.target.value || null)} className={inputCls} />
          </Field>
        </Grid>
      </Section>

      {/* Section: Access */}
      <Section title="Доступ и условия">
        <Grid>
          <Field label="ФЛ">
            <select value={data.investor_type_fl ?? ""} onChange={(e) => patch("investor_type_fl", e.target.value || null)} className={inputCls}>
              <option value="">—</option>
              {INVESTOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="ЮЛ">
            <select value={data.investor_type_ul ?? ""} onChange={(e) => patch("investor_type_ul", e.target.value || null)} className={inputCls}>
              <option value="">—</option>
              {INVESTOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <Field label="Мин. чек">
            <input value={data.min_check ?? ""} onChange={(e) => patch("min_check", e.target.value || null)} className={inputCls} />
          </Field>
          <Field label="Логистика денег">
            <input value={data.logistics ?? ""} onChange={(e) => patch("logistics", e.target.value || null)} className={inputCls} />
          </Field>
        </Grid>
      </Section>

      {/* Section: Texts */}
      <Section title="Тексты">
        <Field label="Цель стратегии">
          <textarea
            rows={3}
            value={data.strategy_goal ?? ""}
            onChange={(e) => patch("strategy_goal", e.target.value || null)}
            className={cn(inputCls, "resize-y")}
          />
        </Field>
        <Field label="Описание">
          <textarea
            rows={6}
            value={data.description ?? ""}
            onChange={(e) => patch("description", e.target.value || null)}
            className={cn(inputCls, "resize-y")}
          />
        </Field>
      </Section>

      {/* Section: Why bullets — string[] */}
      <Section title="Why-буллеты">
        <ListEditor
          items={data.why_bullets ?? []}
          onChange={(items) => patch("why_bullets", items)}
          newItem={() => ""}
          render={(item, set) => (
            <input value={item} onChange={(e) => set(e.target.value)} className={inputCls} placeholder="Тезис…" />
          )}
        />
      </Section>

      {/* Section: Fees */}
      <Section title="Структура расходов">
        <div className="text-sm text-muted-foreground mb-2">
          5 тиров от объёма USD. MF = management fee %, SF = success fee %, Hurdle = бенчмарк превышения (пусто = абсолютный).
        </div>
        <ListEditor<MgmtFeeTier>
          items={data.mgmt_fee_tiers ?? []}
          onChange={(items) => patch("mgmt_fee_tiers", items)}
          newItem={() => ({ tier: "<3m", mf: 1.0, sf: null, hurdle: null })}
          render={(item, set) => (
            <div className="grid grid-cols-4 gap-2">
              <input value={item.tier} onChange={(e) => set({ ...item, tier: e.target.value })} placeholder="<3m" className={inputCls} />
              <input type="number" step="0.01" value={item.mf ?? ""} onChange={(e) => set({ ...item, mf: e.target.value === "" ? null : parseFloat(e.target.value) })} placeholder="MF %" className={inputCls} />
              <input type="number" step="0.01" value={item.sf ?? ""} onChange={(e) => set({ ...item, sf: e.target.value === "" ? null : parseFloat(e.target.value) })} placeholder="SF %" className={inputCls} />
              <input value={item.hurdle ?? ""} onChange={(e) => set({ ...item, hurdle: e.target.value || null })} placeholder="Hurdle" className={inputCls} />
            </div>
          )}
        />

        <Grid className="mt-4">
          <Field label="Скидка 1-й год, %">
            <input type="number" step="0.1" value={data.redemption_discount_y1 ?? 0} onChange={(e) => patch("redemption_discount_y1", parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Скидка 2-й год, %">
            <input type="number" step="0.1" value={data.redemption_discount_y2 ?? 0} onChange={(e) => patch("redemption_discount_y2", parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>
        </Grid>

        <Field label="Дополнительные расходы">
          <input value={data.extra_expenses ?? ""} onChange={(e) => patch("extra_expenses", e.target.value || null)} className={inputCls} />
        </Field>
        <label className="inline-flex items-center gap-2 text-sm mt-3">
          <input type="checkbox" checked={data.hwm ?? false} onChange={(e) => patch("hwm", e.target.checked)} />
          High-Water Mark
        </label>
      </Section>

      {/* Section: Risks */}
      <Section title="Ключевые риски">
        <ListEditor<RiskItem>
          items={data.risks ?? []}
          onChange={(items) => patch("risks", items)}
          newItem={() => ({ name: "", severity: "Средний", description: "" })}
          render={(item, set) => (
            <div className="grid grid-cols-[2fr_1fr_3fr] gap-2">
              <input value={item.name} onChange={(e) => set({ ...item, name: e.target.value })} placeholder="Название риска" className={inputCls} />
              <select value={item.severity} onChange={(e) => set({ ...item, severity: e.target.value })} className={inputCls}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={item.description} onChange={(e) => set({ ...item, description: e.target.value })} placeholder="Описание" className={inputCls} />
            </div>
          )}
        />
      </Section>

      {/* Section: Top positions */}
      <Section title="Топ-позиции">
        <Field label="Дата снимка позиций">
          <input
            type="date"
            value={data.top_positions_as_of ?? ""}
            onChange={(e) => patch("top_positions_as_of", e.target.value || null)}
            className={inputCls}
          />
        </Field>
        <ListEditor<TopPosition>
          items={data.top_positions ?? []}
          onChange={(items) => patch("top_positions", items)}
          newItem={() => ({ instrument: "Акции" })}
          render={(item, set) => (
            <div className="grid grid-cols-5 gap-2">
              <input value={item.instrument ?? ""} onChange={(e) => set({ ...item, instrument: e.target.value })} placeholder="Инструмент" className={inputCls} />
              <input value={item.issuer ?? item.issue ?? ""} onChange={(e) => set({ ...item, issuer: e.target.value, issue: undefined })} placeholder="Эмитент / Выпуск" className={inputCls} />
              <input value={item.weight ?? ""} onChange={(e) => set({ ...item, weight: e.target.value || undefined })} placeholder="Доля %" className={inputCls} />
              <input value={item.coupon ?? ""} onChange={(e) => set({ ...item, coupon: e.target.value || undefined })} placeholder="Купон" className={inputCls} />
              <input value={item.maturity ?? ""} onChange={(e) => set({ ...item, maturity: e.target.value || undefined })} placeholder="Погашение" className={inputCls} />
            </div>
          )}
        />
      </Section>

      {/* Section: Documents */}
      <Section title="Документы">
        <ListEditor<DocLink>
          items={data.documents ?? []}
          onChange={(items) => patch("documents", items)}
          newItem={() => ({ name: "", url: "" })}
          render={(item, set) => (
            <div className="grid grid-cols-2 gap-2">
              <input value={item.name} onChange={(e) => set({ ...item, name: e.target.value })} placeholder="Название" className={inputCls} />
              <input value={item.url} onChange={(e) => set({ ...item, url: e.target.value })} placeholder="https://…" className={inputCls} />
            </div>
          )}
        />
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
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-muted-foreground/70" dangerouslySetInnerHTML={{ __html: hint }} />}
    </label>
  );
}

interface ListEditorProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  render: (item: T, setItem: (item: T) => void) => React.ReactNode;
}

function ListEditor<T>({ items, onChange, newItem, render }: ListEditorProps<T>) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            {render(item, (next) => {
              const copy = items.slice();
              copy[i] = next;
              onChange(copy);
            })}
          </div>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
            title="Удалить"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, newItem()])}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Добавить
      </button>
    </div>
  );
}
