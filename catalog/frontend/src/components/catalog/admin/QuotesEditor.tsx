"use client";

/**
 * NAV-quotes table editor for a single fund.
 *
 * Features:
 *   - Sparkline preview of all loaded prices
 *   - Inline add / edit / delete of single rows
 *   - CSV upload (with optional `replace=true`) — accepts header `date,price_rub,price_native`
 *
 * Each mutation invalidates the `fund-quotes` query, so the preview refreshes immediately.
 */

import { ChangeEvent, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Upload, AlertTriangle } from "lucide-react";
import {
  bulkUploadQuotes,
  createQuote,
  deleteQuote,
  fetchQuotes,
  updateQuote,
  type FundQuote,
  type BulkUploadResult,
} from "@/lib/api";
import { Sparkline } from "@/components/catalog/Sparkline";
import { cn } from "@/lib/utils";

interface Props {
  fundKey: string;
  /** Native currency label used as `price_native` column header. */
  ccy: string;
}

const inputCls =
  "w-full rounded border border-border bg-background px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40";

export function QuotesEditor({ fundKey, ccy }: Props) {
  const qc = useQueryClient();
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["fund-quotes", fundKey],
    queryFn: () => fetchQuotes(fundKey),
  });

  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ date: "", price_rub: "", price_native: "" });
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  const [replace, setReplace] = useState(false);

  const addMut = useMutation({
    mutationFn: () =>
      createQuote(fundKey, {
        date: draft.date,
        price_rub: parseFloat(draft.price_rub),
        price_native: draft.price_native ? parseFloat(draft.price_native) : null,
      }),
    onSuccess: () => {
      setDraft({ date: "", price_rub: "", price_native: "" });
      qc.invalidateQueries({ queryKey: ["fund-quotes", fundKey] });
      qc.invalidateQueries({ queryKey: ["funds-series"] });   // sparklines on list page
      qc.invalidateQueries({ queryKey: ["performance", fundKey] });
    },
  });

  const editMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Omit<FundQuote, "id"> }) =>
      updateQuote(fundKey, id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fund-quotes", fundKey] });
      qc.invalidateQueries({ queryKey: ["funds-series"] });
      qc.invalidateQueries({ queryKey: ["performance", fundKey] });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteQuote(fundKey, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fund-quotes", fundKey] });
      qc.invalidateQueries({ queryKey: ["funds-series"] });
      qc.invalidateQueries({ queryKey: ["performance", fundKey] });
    },
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => bulkUploadQuotes(fundKey, file, replace),
    onSuccess: (res) => {
      setBulkResult(res);
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["fund-quotes", fundKey] });
      qc.invalidateQueries({ queryKey: ["funds-series"] });
      qc.invalidateQueries({ queryKey: ["performance", fundKey] });
    },
  });

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) uploadMut.mutate(f);
  }

  // For preview sparkline — normalize to 100
  const series = (() => {
    if (quotes.length < 2) return [];
    const v0 = quotes[0].price_rub;
    return quotes.map((q) => (q.price_rub / v0) * 100);
  })();

  return (
    <fieldset className="rounded-xl border border-border bg-card p-5 space-y-4">
      <legend className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        NAV-серия ({quotes.length} точек)
      </legend>

      {/* Preview */}
      {quotes.length >= 2 && (
        <div className="rounded-md border border-border p-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
            Превью (rebased 100)
          </div>
          <Sparkline points={series} width={600} height={80} tone="up" className="w-full" />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{quotes[0].date}</span>
            <span>{quotes[quotes.length - 1].date}</span>
          </div>
        </div>
      )}

      {/* CSV upload */}
      <div className="rounded-md border border-dashed border-border p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium">Загрузить CSV</div>
            <div className="text-[11px] text-muted-foreground">
              колонки: <code>date,price_rub,price_native</code> (последняя опциональна)
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            <span>Заменить весь ряд</span>
          </label>
          <label className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 cursor-pointer">
            <Upload className="h-4 w-4" /> {uploadMut.isPending ? "Загрузка…" : "Выбрать файл"}
            <input ref={fileInput} type="file" accept=".csv" onChange={onFile} className="hidden" />
          </label>
        </div>
        {bulkResult && (
          <div className="text-xs space-y-1">
            <div>
              inserted={bulkResult.inserted} · updated={bulkResult.updated} · skipped={bulkResult.skipped}
            </div>
            {bulkResult.errors.length > 0 && (
              <details className="text-destructive">
                <summary className="cursor-pointer">
                  <AlertTriangle className="inline h-3 w-3 mr-1" /> {bulkResult.errors.length} ошибок
                </summary>
                <ul className="ml-4 list-disc">
                  {bulkResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Add row */}
      <div className="rounded-md border border-border p-3">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
          Добавить точку
        </div>
        <div className="flex items-end gap-2">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            className={cn(inputCls, "flex-1")}
            placeholder="YYYY-MM-DD"
          />
          <input
            type="number"
            step="0.0001"
            value={draft.price_rub}
            onChange={(e) => setDraft((d) => ({ ...d, price_rub: e.target.value }))}
            placeholder="price_rub"
            className={cn(inputCls, "flex-1")}
          />
          <input
            type="number"
            step="0.0001"
            value={draft.price_native}
            onChange={(e) => setDraft((d) => ({ ...d, price_native: e.target.value }))}
            placeholder={`price_native (${ccy})`}
            className={cn(inputCls, "flex-1")}
          />
          <button
            type="button"
            disabled={!draft.date || !draft.price_rub || addMut.isPending}
            onClick={() => addMut.mutate()}
            className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Добавить
          </button>
        </div>
      </div>

      {/* Table — paginated to most recent 100 */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      ) : quotes.length === 0 ? (
        <div className="text-sm text-muted-foreground">Нет точек — загрузите CSV или добавьте вручную.</div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">Date</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">price_rub</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">price_native ({ccy})</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...quotes].reverse().slice(0, 100).map((q) => (
                <QuoteRow
                  key={q.id}
                  q={q}
                  onSave={(payload) => editMut.mutate({ id: q.id, payload })}
                  onDelete={() => delMut.mutate(q.id)}
                />
              ))}
            </tbody>
          </table>
          {quotes.length > 100 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
              Показаны последние 100 из {quotes.length}. Для массового изменения — CSV-upload.
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}

function QuoteRow({
  q,
  onSave,
  onDelete,
}: {
  q: FundQuote;
  onSave: (payload: Omit<FundQuote, "id">) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(q.date);
  const [priceRub, setPriceRub] = useState(String(q.price_rub));
  const [priceNative, setPriceNative] = useState(q.price_native != null ? String(q.price_native) : "");

  function save() {
    onSave({
      date,
      price_rub: parseFloat(priceRub),
      price_native: priceNative ? parseFloat(priceNative) : null,
    });
    setEditing(false);
  }

  return (
    <tr className="border-t border-border hover:bg-accent/30">
      <td className="px-3 py-1.5">
        {editing ? (
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        ) : (
          <span onDoubleClick={() => setEditing(true)} title="2× клик — редактировать">{q.date}</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-right">
        {editing ? (
          <input type="number" step="0.0001" value={priceRub} onChange={(e) => setPriceRub(e.target.value)} className={cn(inputCls, "text-right")} />
        ) : (
          <span onDoubleClick={() => setEditing(true)}>{q.price_rub.toFixed(4)}</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-right">
        {editing ? (
          <input type="number" step="0.0001" value={priceNative} onChange={(e) => setPriceNative(e.target.value)} className={cn(inputCls, "text-right")} />
        ) : (
          <span onDoubleClick={() => setEditing(true)} className={q.price_native == null ? "text-muted-foreground-2" : ""}>
            {q.price_native?.toFixed(4) ?? "—"}
          </span>
        )}
      </td>
      <td className="px-3 py-1.5">
        {editing ? (
          <div className="flex gap-1">
            <button type="button" onClick={save} className="text-emerald-600 hover:underline text-[11px]">save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:underline text-[11px]">cancel</button>
          </div>
        ) : (
          <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}
