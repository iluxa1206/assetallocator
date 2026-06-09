# Astra AM Sales Desk — Статус проекта

Дата актуализации: 2026-05-28

---

## 1. Обзор

Внутренний инструмент управляющей компании Astra AM для сейлз-менеджеров.
Позволяет подбирать инвестиционную стратегию клиенту, делать бэктест
портфеля и выгружать отчёты.

**Общий прогресс: ~50%**

---

## 2. Инфраструктура

| Компонент | Статус | Детали |
|---|---|---|
| Docker Compose | ✅ | PostgreSQL 5434, FastAPI 8010, Mailpit 1026/8026 |
| Next.js frontend | ✅ | v16.2.6, порт 3010 |
| FastAPI backend | ✅ | порт 8010, Python 3.13, uv |
| Auth (JWT) | ✅ | fastapi-users, login/register/reset/verify |
| Seed-скрипт | ✅ | `scripts/seed_from_excel.py` из `фонды_111-11.xlsx` |

Запуск: `cd catalog && docker compose up -d && cd frontend && npm run dev`
Вход: `http://localhost:3010` → `admin@astra.local` / `admin123`

---

## 3. Стек

| Слой | Технологии |
|---|---|
| Frontend | Next.js 16.2.6, React 19, TypeScript strict, Tailwind v4, shadcn/ui, Zustand, React Query, Recharts |
| Backend | FastAPI 0.136, SQLAlchemy 2.0 async, fastapi-users, Pydantic v2 |
| DB | PostgreSQL 16 (Docker named volume `postgres_data`) |
| Package managers | uv (Python), npm (Node) |

---

## 4. Реализованный функционал

### 4.1. Расчётный движок (бэкенд) — 100%

Модули в `catalog/app/calculations/`:

| Модуль | Назначение |
|---|---|
| `constants.py` | Аллокации, метаданные фондов, бенчмарки |
| `fx_rates.py` | Кросс-курсы, `rubToBase`, `fxRate(from, to, date)` |
| `allocation.py` | Весовые доли по риск-профилю и валютной стратегии |
| `series.py` | Нормированные ряды портфеля и бенчмарка |
| `metrics.py` | CAGR (база 365 дн.), волатильность (√12), макс. просадка, Шарп |
| `cpi.py` | Накопленная инфляция по YoY-формуле, кеш `getGlobalCpiLevels` |
| `fx_decomp.py` | FX-декомпозиция: фундаментал + FX-эффект, тождество проверено |

API: `POST /api/v1/portfolio/compute` — расчёт за один запрос.
Верификация: совпадение с эталоном `Книга2.xlsx` до копейки.

### 4.2. Dashboard UI (фронтенд) — 85%

Путь: `catalog/frontend/src/app/(app)/dashboard/page.tsx`

| Блок | Статус | Компонент |
|---|---|---|
| SetupGrid (сумма, риск, валюта) | ✅ | `SetupGrid.tsx` |
| AllocationChart (2 доната) | ✅ | `AllocationChart.tsx` |
| KpiStrip (5 метрик) | ✅ | `KpiStrip.tsx` |
| Период бэктеста | ✅ | `MonthYearPicker.tsx` |
| Валюта расчёта (RUB/USD/CNY) | ✅ | inline в page.tsx |
| MainChart + тоглы (индекс/инфляция) | ✅ | `MainChart.tsx` |
| CompareTable (портфель vs бенчмарк) | ✅ | `CompareTable.tsx` |
| ComponentTable (результат по фондам) | ✅ | `ComponentTable.tsx` |
| FxTable (FX-декомпозиция) | ✅ | `FxTable.tsx` |
| ExportBar (PDF/Excel/письмо) | 🔴 stub | кнопки без логики |
| ManualPanel (ручная аллокация) | ✅ | `ManualPanel.tsx`, 2-col grid, sum guard |

### 4.3. Навигация и аутентификация — 100%

- Sidebar с роутами `/dashboard`, `/clients`, `/proposals`
- JWT через cookie, защита роутов через `src/proxy.ts`
- Страница `/login` с редиректом после входа

### 4.4. Prototype (HTML) — архив

`sales_dashboard_v5.html` — полностью рабочий standalone:
PDF, Excel (SheetJS), шаблон письма, ручной режим, тёмная тема.
Используется как эталон логики и UX.

---

## 5. Что не реализовано (gap)

| Функционал | Приоритет | Заметки |
|---|---|---|
| **ExportBar** — PDF, Excel, шаблон письма | 🔴 HIGH | PDF: WeasyPrint. Excel: openpyxl. `app/export/` будет создан при работе. |
| ~~**ManualPanel**~~ — ручная аллокация | ✅ FIXED 2026-05-28 | `ManualPanel.tsx` + wire в page.tsx + lock SetupGrid |
| **CRM: `/clients`** — список клиентов | 🟡 MED | Модели в БД есть, роутов и страниц нет |
| **CRM: `/proposals`** — сохранение предложений | 🟡 MED | Основной user-journey не замкнут |
| **Dark mode** | 🟡 MED | ThemeToggle есть, CSS-переменные неполные |
| **Тесты** | 🟡 MED | pytest и vitest отсутствуют; расчётный движок без coverage |
| **Alembic миграции** | 🟡 MED | Сейчас `create_all()`, техдолг при изменении схемы |
| **Rate limiting** на `/compute` | 🟡 MED | Full scan таблиц на каждый запрос без кеша |
| **TTL-кеш market data** | 🟡 MED | `_load_market` / `_load_fund_prices` — 2 full scan per request |
| **Admin `/admin`** | 🟢 LOW | Не начат |
| **PWA / offline** | 🟢 LOW | Не начат |

---

## 6. Технический долг

| Проблема | Файл | Severity |
|---|---|---|
| ~~JWT в `localStorage`~~ → HttpOnly cookie | `login/page.tsx`, `lib/api.ts` | ✅ FIXED 2026-05-28 |
| ~~Hardcoded `SECRET_KEY`~~ → `.env` через `env_file:` | `docker-compose.yml`, `core/config.py` | ✅ FIXED 2026-05-28 |
| ~~`BearerTransport`~~ → `CookieTransport(httponly, samesite=lax)` | `app/core/users.py` | ✅ FIXED 2026-05-28 |
| `PortfolioRequest.risk: str` — нет валидации, KeyError 500 | `app/schemas/portfolio.py` | 🟡 |
| N+1 вычислений в `portfolio_service.py:100-128` | `calculations/` | 🟡 |
| O(N²) в `cpi.py:48` — `getGlobalCpiLevels` per-date | `cpi.py` | 🟡 |
| ~~Константы `CCY_LABEL/CCY_SYM` в 3 файлах~~ → `lib/format.ts` | frontend | ✅ FIXED 2026-05-28 |

---

## 7. Недавние изменения (2026-05-28)

### Dashboard UI

- **AllocationChart** — доунаты увеличены (innerRadius 42→68, outerRadius 64→104),
  layout переделан: диаграмма сверху, список фондов снизу
- **AllocationChart** — кастомный тултип (`FundTooltip`) с `bg-popover`,
  `shadow-xl`, `z-index: 9999`
- **AllocationChart** — анимация recharts заменена на CSS-transition
  `d 0.45s ease-in-out` для плавной смены долей без "draw from zero"
- **AllocationChart** — `ResponsiveContainer` удалён, заменён на
  `PieChart width={220} height={220}` — фикс SSR ошибки `width(-1) height(-1)`
- **MonthYearPicker** — новый компонент вместо `<select>`:
  год со стрелками + сетка 3×4 месяцев, недоступные месяцы greyed out
- **MonthYearPicker** — фикс: нормализация `YYYY-MM-DD` → `YYYY-MM`
  для lookup в `availableSet`

---

## 8. Десять фондов

| Ключ | Название | Валюта | Бенчмарк |
|---|---|---|---|
| R5 | Хедж-фонд Р5 | RUB | RGBITR |
| Aplus | Хедж-фонд А+ | RUB | MCFTR |
| A12080 | Российские акции 120/80 | RUB | MCFTR |
| R1 | Облигации Р1 | RUB | RGBITR |
| Liq | Фонд денежной ликвидности | RUB (синтетика) | RUSFAR |
| D5 | Хедж-фонд Д5 | USD | CbondsZO_RUB |
| D1 | Хедж-фонд Д1 | USD | CbondsZO_RUB |
| VO | Валютные облигации с выплатой дохода | USD | CbondsZO_RUB |
| Yu5 | Хедж-фонд Ю5 | CNY | RUCNYTR_RUB |
| M3 | Хедж-фонд М3 | GLD | GLDRUB |

Liq — синтетический ряд: `RUSFAR[t] / 1282.06 × 1000`
M3 (GLD) — валютный актив, не рублёвый.

---

## 9. Порты (фиксированные)

| Сервис | Внешний |
|---|---|
| Frontend (Next.js) | 3010 |
| Backend (FastAPI) | 8010 |
| PostgreSQL | 5434 |
| Mailpit SMTP | 1026 |
| Mailpit Web UI | 8026 |

---

## 10. Следующий спринт (приоритеты)

1. ~~**ManualPanel**~~ ✅ done 2026-05-28
2. ~~**Critical security**~~ ✅ done 2026-05-28 (JWT HttpOnly cookie + SECRET_KEY env + ложный proxy/middleware пункт удалён)
3. **ExportBar** — PDF (WeasyPrint / print CSS), Excel (openpyxl), шаблон письма
4. **CRM минимум** — `/clients` list + `/proposals` create/read
5. **Кеш market data** — TTL-кеш для `_load_market`/`_load_fund_prices`
