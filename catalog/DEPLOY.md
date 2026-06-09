# Деплой на assetallocation.ru (локальная машина + Cloudflare Tunnel)

Прод-стек на локальном компьютере, наружу через **Cloudflare Tunnel** (бесплатно, за CGNAT/динам. IP,
без открытых портов, TLS на edge). Данные в РФ → 152-ФЗ.

> ВАЖНО: прошлая сеть провайдера резала туннель (DPI рвёт TLS до edge на 7844). Запускать с сети,
> которая Cloudflare Tunnel пропускает. Стек уже выставлен на `TUNNEL_TRANSPORT_PROTOCOL=http2`
> (TCP 7844) — если не идёт, убрать эту строку в compose чтобы пробовать QUIC.

Изолирован от dev: `docker-compose.prod.yml` имеет `name: astra-prod` → отдельные volume/сеть.

## Файлы

| Файл | Назначение |
|---|---|
| `docker-compose.prod.yml` | postgres + mailpit + backend + frontend + cloudflared |
| `.env.prod` | Секреты (gitignored): `POSTGRES_PASSWORD`, `SECRET_KEY`, `TUNNEL_TOKEN` |
| `.env.prod.example` | Шаблон секретов |
| `Caddyfile` | (не используется при туннеле — для варианта «VPS + Caddy») |

## Однократная настройка Cloudflare

1. Бесплатный аккаунт Cloudflare → добавить домен `assetallocation.ru`.
2. У регистратора **сменить NS-серверы** на выданные Cloudflare (распространение до неск. часов).
3. Zero Trust → **Networks → Tunnels** → создать туннель типа **Cloudflared** → скопировать **Tunnel token**.
4. Вписать токен в `.env.prod` → `TUNNEL_TOKEN=`.
5. Public Hostnames туннеля:
   - `assetallocation.ru` → Service `HTTP` → `frontend:3000`
   - `www.assetallocation.ru` → то же (опц.)
6. (Опц.) **Access** → доп. авторизация поверх портала. Бесплатно до 50 юзеров.

## Запуск

```bash
cd catalog
# .env.prod уже с секретами; убедиться что TUNNEL_TOKEN вписан
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# проверить туннель:
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f cloudflared
# ждём строку "Registered tunnel connection"
```

Первый деплой — миграции + наполнение БД (скрипты как модули `-m`):
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run alembic upgrade head
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run python -m scripts.seed_admin
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run python -m scripts.seed_catalog
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run python -m scripts.seed_strategies
```

Открыть **https://assetallocation.ru** → логин `admin@astra.local` / `admin123`.

## macOS: держать online

- Docker Desktop → автозапуск при логине.
- Не давать спать: System Settings → отключить сон, либо `caffeinate -dimsu &`.
- Контейнеры `restart: unless-stopped` → поднимаются после ребута.

## Бэкап БД (cron)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U astra astra | gzip > backup_$(date +%F).sql.gz
```

## Безопасность

- `SECRET_KEY`, `POSTGRES_PASSWORD` — случайные (уже сгенерены), не dev-дефолты.
- Портов на host нет — доступ только через туннель.
- `COOKIE_SECURE=true` (в compose) — куки только по HTTPS.
- 152-ФЗ: политика обработки ПД + уведомление в Роскомнадзор.

## Если туннель не идёт с новой сети

Логи `cloudflared`: `TLS handshake error: EOF` или `no recent network activity` = сеть режет туннель.
Тогда — вариант «VPS + Caddy» (см. git-историю DEPLOY.md / `Caddyfile`).
