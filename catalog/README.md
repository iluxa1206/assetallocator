# Astra AM Sales Desk

Внутренний веб-портал для отдела продаж: каталог фондов и модельных стратегий, бэктест портфелей, генерация инвестпредложений.

**Стек:** FastAPI 0.136 (Python 3.13) + Next.js 16 (React 19, TypeScript, Tailwind v4) + PostgreSQL 16.

---

## Быстрый старт

```bash
cd catalog
docker compose up -d --build         # postgres + mailpit + backend (FastAPI)
cd frontend && npm install && npm run dev    # Next.js dev, отдельный процесс
```

Подождать ~30 секунд → открыть **http://localhost:3010** → login `admin@astra.local` / `admin123`.

---

## Порты (фиксированы)

| Сервис | URL | Внутри Docker |
|---|---|---|
| Frontend (Next.js dev) | http://localhost:3010 | — |
| Backend (FastAPI) | http://localhost:8010 | 8000 |
| Swagger docs | http://localhost:8010/docs | — |
| PostgreSQL | localhost:**5434** | 5432 |
| Mailpit SMTP | localhost:1026 | 1025 |
| Mailpit Web UI | http://localhost:8026 | 8025 |

---

## Структура проекта

```
catalog/
├── docker-compose.yml          Postgres + Mailpit + Backend (фронт локально)
├── backend/                    FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── auth.py         Login (cookie + bearer), register, reset-password
│   │   │   ├── users.py        /users/me, CRUD юзеров
│   │   │   ├── portfolio.py    POST /portfolio/compute — бэктест портфеля
│   │   │   ├── funds.py        Каталог фондов: read + admin CRUD + /funds/series
│   │   │   └── strategies.py   Каталог модельных стратегий: read + admin CRUD
│   │   ├── core/
│   │   │   ├── config.py       Settings (env: DATABASE_URL, SECRET_KEY, …)
│   │   │   └── users.py        fastapi-users: JWT + cookie + bearer backends
│   │   ├── models/             SQLAlchemy ORM (Fund, Strategy, User, FundQuote, …)
│   │   ├── schemas/            Pydantic in/out
│   │   ├── calculations/       Чистые функции бэктеста (series, metrics, fx, allocation)
│   │   └── services/           Оркестрация (portfolio_service)
│   ├── alembic/versions/       Миграции БД (последовательно)
│   └── scripts/
│       ├── seed_admin.py       Создать/обновить superuser (idempotent)
│       ├── seed_catalog.py     15 фондов/ДУ/Advisory из презентации (idempotent)
│       └── seed_strategies.py  9 модельных портфелей из constants.ALLOCATIONS
│
└── frontend/                   Next.js 16 App Router
    ├── src/
    │   ├── app/
    │   │   ├── (auth)/login/   Логин-форма (Bearer-flow + manual cookie)
    │   │   └── (app)/
    │   │       ├── layout.tsx          Sidebar + main
    │   │       ├── dashboard/          Подбор стратегии + бэктест
    │   │       └── catalog/
    │   │           ├── layout.tsx      Табы Фонды / Стратегии
    │   │           ├── funds/          Список (hero-карты 2 col) + детали
    │   │           └── strategies/     Список + детали
    │   ├── components/
    │   │   ├── layout/Sidebar.tsx
    │   │   ├── dashboard/              Setup/KPI/MainChart/CompareTable/…
    │   │   └── catalog/Sparkline.tsx   inline SVG спарклайн
    │   ├── lib/
    │   │   ├── api.ts                  axios-обёртки над эндпоинтами
    │   │   ├── types.ts                TS-зеркало Pydantic схем
    │   │   ├── format.ts               numSpaces/fmtPct/fmtCompact (ru-RU)
    │   │   ├── catalog-meta.ts         Категории + иконки lucide + сортировка
    │   │   └── utils.ts                cn helper
    │   ├── stores/                     Zustand (portfolio, theme)
    │   └── proxy.ts                    Next 16 middleware: auth-redirect на /login
    └── next.config.ts                  Rewrite /api/* → backend:8010
```

---

## Что за что отвечает

### Backend подсистемы

| Слой | Файлы | Ответственность |
|---|---|---|
| **Auth** | `app/core/users.py`, `app/api/v1/auth.py` | fastapi-users. Два backend'а: cookie (HttpOnly) и bearer (JSON-токен) — фронт использует bearer и сам ставит cookie, чтоб обойти стрипинг Set-Cookie через Next dev proxy. |
| **Каталог фондов** | `app/models/fund.py`, `app/api/v1/funds.py` | 15 записей: 10 ИПИФ + 3 ДУ + 2 Advisory. JSONB-поля для рисков, топ-позиций, fee-tiers, why-bullets. `/funds/series?range=1y` — батч NAV + CAGR/Vol/MaxDD одной выборкой. |
| **Каталог стратегий** | `app/models/strategy.py`, `app/api/v1/strategies.py` | 7 портфелей: base + 3 риск-профиля × 3 валютных вектора. Composition хранится как JSONB `{fund_key: weight_%}`. Сидится из `app/calculations/constants.ALLOCATIONS`. |
| **Бэктест** | `app/api/v1/portfolio.py`, `app/calculations/*`, `app/services/portfolio_service.py` | Принимает риск-профиль + ccy + сумму + диапазон дат → возвращает NAV-серии, метрики, FX-декомпозицию. Используется на /dashboard. |
| **Миграции** | `alembic/versions/*` | Альембик. Запускать только через docker compose exec (см. ниже). |

### Frontend подсистемы

| Раздел | Маршрут | Зависит от |
|---|---|---|
| **Login** | `/login` | `POST /auth/jwt/login` |
| **Dashboard** | `/dashboard` | `POST /portfolio/compute` + Zustand store |
| **Каталог → Фонды** | `/catalog/funds`, `/catalog/funds/[key]` | `GET /funds`, `GET /funds/series`, `GET /funds/{key}` |
| **Каталог → Стратегии** | `/catalog/strategies`, `/catalog/strategies/[code]` | `GET /strategies`, `GET /strategies/{code}` + `GET /funds` для имён |
| **Admin кнопки** | везде в каталоге | `GET /users/me` → если `is_superuser` → кнопки «+ Добавить» и «Редактировать» (формы пока не реализованы, task #11-12) |

---

## Типовые операции

### Применить миграции

```bash
docker compose exec backend uv run alembic upgrade head
```

### Накатить сиды (idempotent — можно гонять несколько раз)

```bash
docker compose exec backend uv run python -m scripts.seed_admin       # superuser
docker compose exec backend uv run python -m scripts.seed_catalog     # 15 фондов
docker compose exec backend uv run python -m scripts.seed_strategies  # 7 стратегий
```

### Создать новую миграцию

```bash
# После правки app/models/*.py
docker compose exec backend uv run alembic revision --autogenerate -m "what changed"
# Файл создастся в backend/alembic/versions/ — проверить руками, потом upgrade
```

### Поменять пароль admin / создать другого

```bash
docker compose exec backend \
  -e ADMIN_EMAIL=other@astra.local \
  -e ADMIN_PASSWORD=secret \
  python -m scripts.seed_admin
```

### Бэкап БД

```bash
docker compose exec postgres pg_dump -U astra astra > backup.sql
```

### Полный сброс (потеря данных)

```bash
docker compose down -v   # -v убивает volumes
docker compose up -d --build
docker compose exec backend uv run alembic upgrade head
docker compose exec backend uv run python -m scripts.seed_admin
docker compose exec backend uv run python -m scripts.seed_catalog
docker compose exec backend uv run python -m scripts.seed_strategies
```

---

## Тесты

```bash
docker compose exec backend uv run pytest
cd frontend && npx tsc --noEmit       # TS check (тестов нет пока)
```

---

## Troubleshooting

### Локальный `.venv` на macOS ломается (Linux .so вместо Mach-O)

Docker монтирует `./backend:/app`, поэтому контейнерный `/app/.venv` (Linux ARM) попадает на хост.
Уже зафикшено named volume `backend_venv` в docker-compose.yml.

Если до сих пор сломан — пересоздать локально:
```bash
cd catalog/backend
mv .venv /tmp/v-bad-$RANDOM
UV_NO_CACHE=1 uv sync --reinstall
```

**Локальные alembic/scripts запускать так:**
```bash
DATABASE_URL=postgresql+asyncpg://astra:astra_dev@localhost:5434/astra \
  .venv/bin/python -m scripts.seed_catalog
```
(`.env` смотрит на Docker-host `postgres:5432`, локально не резолвится.)

### После login редирект на /login

`Set-Cookie` от backend иногда теряется через Next dev rewrite proxy. Login-форма использует bearer endpoint `/auth/jwt/login`, возвращающий JSON, и сама ставит `document.cookie` + `localStorage`. Если всё ещё «не пускает»:
1. DevTools → Application → Cookies → удалить старый `access_token`
2. Hard refresh `/login` (Cmd+Shift+R)

### `alembic` падает с `No module named 'mako'`

Локальный venv. Внутри Docker контейнера всё работает. См. предыдущий пункт.

### `Too many open files`

```bash
ulimit -n 4096
```

---

## Conventions

- **Цена**: pure-decimal в API (CAGR, ret, vol, max_dd — 0..1). Frontend форматирует через `fmtPct`.
- **Числа в UI**: tabular-nums + неразрывный пробел разделитель тысяч (`numSpaces`).
- **Currency tint**: RUB → синий, USD/CNY/GLD → золотой.
- **Severity рисков**: высокий → rose, средний → amber, низкий/минимальный → emerald.
- **Risk-profile в стратегиях**: base → slate, cons → emerald, agg → rose.
- **Fund colors на dashboard'е**: RUB → blue палитра, FX → gold (`#a07a3d`+).

---

## Дальше по roadmap'у

Не реализовано:
- Task #11: admin форма создания/редактирования фонда (nested JSONB)
- Task #12: admin форма стратегии (валидация суммы весов = 100%)
- AUM по фондам, биографии управляющих, ссылки на ПДУ — данные не предоставлены
