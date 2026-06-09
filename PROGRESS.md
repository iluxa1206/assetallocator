# Astra AM Sales Desk — Прогресс разработки

Актуализировано: 2026-05-28

---

## Инфраструктура

| Компонент | Статус | Детали |
|---|---|---|
| Docker Compose | ✅ | postgres 5434, backend 8010, mailpit 1026/8026 |
| PostgreSQL 16 | ✅ | volume `postgres_data`, БД `astra` |
| FastAPI backend | ✅ | порт 8010, hot-reload через uvicorn |
| Next.js frontend | ✅ | порт 3010, `npm run dev` локально |
| Mailpit (SMTP dev) | ✅ | web UI 8026, SMTP 1026 |

Запуск: `cd catalog && docker compose up -d && cd frontend && npm run dev`  
Админ: `http://localhost:3010` → `admin@astra.local` / `admin123`

---

## Неделя 1 — Фундамент ✅ Готово

- [x] FastAPI skeleton, `/health`, CORS (regex: localhost + LAN + any port)
- [x] SQLAlchemy 2.0 async, сессии, base
- [x] Все модели: User, Client, Proposal, Fund, FundQuote, MarketDataPoint, AllocationModel, AuditEvent, Invitation
- [x] fastapi-users: JWT, логин, смена пароля
- [x] Next.js 16.2.6 + TypeScript strict + Tailwind v4 + shadcn/ui
- [x] Страница логина `/login`
- [x] Proxy middleware (`src/proxy.ts` — специфика Next.js 16)
- [x] Защищённый layout с боковой навигацией, ThemeToggle
- [x] Zustand stores: portfolioStore, themeStore
- [x] Seed-скрипт `scripts/seed_from_excel.py` — загрузка из `фонды_111-11.xlsx` + `Книга1.xlsx`

---

## Неделя 2 — Расчёты и данные ✅ Готово

- [x] `app/calculations/constants.py` — FUNDS, INDEX_LIST, ALLOCATIONS
- [x] `app/calculations/fx_rates.py` — fxRate, rubToBaseRate
- [x] `app/calculations/allocation.py` — compute_allocation, getCurrencyBreakdown
- [x] `app/calculations/series.py` — build_portfolio_series, build_benchmark_series
- [x] `app/calculations/metrics.py` — CAGR (365 дней), vol (×√12), max DD
- [x] `app/calculations/cpi.py` — накопленный CPI по YoY-формуле, Feb 29 handled
- [x] `app/calculations/fx_decomp.py` — аддитивная декомпозиция, тождество verified vs Книга2.xlsx
- [x] `app/services/portfolio_service.py` — оркестрация: invested_base, ended_base, metrics_cpi, per-fund amounts
- [x] API: `POST /api/v1/portfolio/calculate`
- [x] Pydantic schemas: PortfolioRequest, PortfolioResponse, FundComponent, Metrics
- [ ] pytest-тесты расчётов — **не написаны**
- [ ] `scripts/generate_test_vectors.py` + TS vitest-тесты — **не написаны**
- [ ] TS-копия формул в `lib/calculations/` — **не реализована**

---

## Неделя 3 — Главный дашборд ✅ Готово

- [x] `SetupGrid` — 3-карточки: сумма (AmountInput с форматированием), риск-профиль, валютная стратегия
- [x] `AllocationChart` — 2 доната: фонды (синие RUB / золотые FX) + валюты (рубль / валюта с детализацией)
- [x] `KpiStrip` — 5 карточек: сумма на старте / конец / результат / CAGR / макс. просадка
- [x] `MainChart` — ComposedChart + Area, тоглы Индекс/Инфляция
- [x] `CompareTable` — портфель vs индекс vs инфляция, 7 строк, цветные заголовки
- [x] `ComponentTable` — таблица по фондам: full numbers, вклад, итого в tfoot
- [x] `FxTable` — FX-декомпозиция
- [x] `src/lib/format.ts` — numSpaces(), fmtFull(), fmtCompact(), fmtPct(), fmtProfit()
- [x] Dashboard page: 2-секционная структура (подбор стратегии + бэктест), period bar inline
- [x] Export bar (PDF / Excel / письмо) — **визуальные placeholders, не функциональны**
- [x] ManualPanel (ручная настройка долей) — **не реализована**
- [ ] Темы (светлая/тёмная через CSS-переменные) — **частично**: ThemeToggle есть, полные CSS-переменные не настроены
- [ ] Экспорт PDF (WeasyPrint) — **не реализован**
- [ ] Экспорт Excel (openpyxl) — **не реализован**
- [ ] IndexedDB кеш через idb-keyval — **не реализован**

---

## Неделя 4 — CRM, предложения, админ, PWA ❌ Не начата

### Мини-CRM `/clients`
- [ ] Список клиентов сейлза
- [ ] Создание / редактирование клиента
- [ ] Карточка клиента со списком предложений

### Предложения `/proposals`
- [ ] Кнопка «Сохранить предложение» на дашборде
- [ ] Диалог выбора клиента
- [ ] Страница `/proposals/[id]` — просмотр + фактический результат
- [ ] Кнопка «Отправить клиенту» → PDF + audit event
- [ ] API: CRUD /proposals, /proposals/{id}/pdf, /proposals/{id}/email-template

### Команда `/team` (для manager)
- [ ] Список сейлзов с метриками активности
- [ ] Просмотр предложений любого сейлза

### Админ `/admin` (для analyst)
- [ ] Загрузка Excel с котировками + diff-превью
- [ ] Редактирование модельных аллокаций (версионирование)
- [ ] Управление пользователями + генерация инвайтов
- [ ] API: /admin/import/*, /admin/allocation-models/*, /admin/users/*

### PWA
- [ ] next-pwa: манифест + service worker
- [ ] Оффлайн-режим: кеш market-data/bundle в IndexedDB
- [ ] Адаптивный UI для планшета/телефона

---

## Долг (технический)

| Задача | Приоритет |
|---|---|
| pytest-тесты для `app/calculations/` | Высокий |
| TS-копия формул + vitest | Высокий |
| ManualPanel (ручная аллокация) | Средний |
| Темы — полные CSS-переменные + dark mode | Средний |
| ExportBar — реальный PDF/Excel | Низкий (Неделя 4) |
| Alembic миграции (сейчас создаётся через create_all) | Средний |

---

## Следующий шаг — Неделя 4

Рекомендуемый порядок:

1. **API endpoints для CRM + предложений** (backend)  
   `app/api/v1/clients.py`, `proposals.py`, `team.py`, `admin.py`

2. **Страницы клиентов и предложений** (frontend)  
   `/clients`, `/clients/[id]`, `/proposals`, `/proposals/[id]`

3. **Кнопка «Сохранить предложение»** на дашборде

4. **ManualPanel** — ручная настройка долей фондов

5. **Админка** — импорт Excel, управление пользователями

6. **PWA** — last

---

## API (реализованные эндпоинты)

| Метод | Путь | Статус |
|---|---|---|
| POST | /api/v1/auth/login | ✅ |
| GET | /api/v1/users/me | ✅ |
| POST | /api/v1/portfolio/calculate | ✅ |
| POST | /api/v1/auth/register | ✅ (fastapi-users) |
| GET/POST/PATCH/DELETE | /clients, /proposals | ❌ |
| GET | /market-data/bundle | ❌ |
| GET | /funds, /funds/{key}/quotes | ❌ |
| POST | /admin/import/* | ❌ |
| GET | /team/* | ❌ |
