"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminUsers, fetchAuditLog, type AuditEventRow } from "@/lib/api";

const PAGE_SIZE = 50;

// Known action → human label; unknown actions fall back to the raw string.
const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Вход в систему",
  "page.view": "Просмотр страницы",
  "file.download": "Скачивание файла",
};

const ACTION_FILTERS = [
  { value: "", label: "Все действия" },
  { value: "auth.login", label: "Входы" },
  { value: "page.view", label: "Просмотры страниц" },
  { value: "file.download", label: "Скачивания" },
];

function describe(e: AuditEventRow): string {
  const label = ACTION_LABEL[e.action] ?? e.action;
  const path = e.payload?.path;
  const file = e.payload?.file;
  if (typeof path === "string") return `${label}: ${path}`;
  if (typeof file === "string") return `${label}: ${file}`;
  return label;
}

export function ActivityTab() {
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", userId, action, dateFrom, dateTo, page],
    queryFn: () =>
      fetchAuditLog({
        user_id: userId || undefined,
        action: action || undefined,
        date_from: dateFrom ? `${dateFrom}T00:00:00` : undefined,
        date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const selectCls =
    "px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <select
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setPage(0); }}
          className={selectCls}
        >
          <option value="">Все сотрудники</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(0); }}
          className={selectCls}
        >
          {ACTION_FILTERS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          className={selectCls}
          aria-label="С даты"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          className={selectCls}
          aria-label="По дату"
        />
      </div>

      {/* ── Events table ── */}
      <div className="glossy rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground border-b border-border">
              <th className="px-4 py-3 font-semibold">Время</th>
              <th className="px-4 py-3 font-semibold">Сотрудник</th>
              <th className="px-4 py-3 font-semibold">Действие</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Загрузка…</td></tr>
            )}
            {!isLoading && !data?.events.length && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Событий не найдено</td></tr>
            )}
            {data?.events.map((e) => (
              <tr key={e.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "medium" })}
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-medium text-card-foreground">{e.user_name || e.user_email || "—"}</span>
                  {e.user_name && e.user_email && (
                    <span className="text-xs text-muted-foreground ml-1.5">{e.user_email}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{describe(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-md border border-input hover:bg-accent disabled:opacity-50 transition-colors"
          >
            Назад
          </button>
          <span>{page + 1} / {totalPages}</span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-md border border-input hover:bg-accent disabled:opacity-50 transition-colors"
          >
            Вперёд
          </button>
          <span className="ml-auto">Всего событий: {data.total}</span>
        </div>
      )}
    </div>
  );
}
