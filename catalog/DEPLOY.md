# Деплой на assetallocator.ru (VPS + Caddy)

Прод-стек на VPS (Ubuntu 24.04), наружу через **Caddy** с автоматическим Let's Encrypt TLS.
Изолирован от dev: `docker-compose.prod.yml` имеет `name: astra-prod` → отдельные volume/сеть.

## Файлы

| Файл | Назначение |
|---|---|
| `docker-compose.prod.yml` | postgres + mailpit + backend + frontend + caddy |
| `Caddyfile` | Caddy reverse proxy → `frontend:3000` |
| `.env.prod` | Секреты (gitignored): `POSTGRES_PASSWORD`, `SECRET_KEY` |
| `.env.prod.example` | Шаблон секретов |
| `seed_data/фонды_111-11.xlsx` | Котировки фондов (Лист1) + рыночные данные (Лист2) |

## Однократная настройка DNS

1. В Cloudflare DNS добавить A-запись: `assetallocator.ru` → IP сервера, **Proxy OFF** (серое облако).
2. NS у регистратора переключены на Cloudflare (`donna.ns.cloudflare.com`, `tim.ns.cloudflare.com`).

## Сервер: первоначальная настройка

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Swap 2GB (4GB RAM мало для сборки фронта)
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## Залить код на сервер

```bash
# С локальной машины
cd /путь/до/astra
rsync -avz --exclude node_modules --exclude .git --exclude '.git.old' \
  --exclude '__pycache__' --exclude '.next' --exclude 'backup_*' \
  catalog/ root@VPS_IP:~/catalog/
```

## Запуск

```bash
cd ~/catalog
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Проверить что все контейнеры `Up`:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

## Первый деплой — наполнение БД

Выполнять строго по порядку:

```bash
# 1. Схема БД
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run alembic upgrade head

# 2. Справочники
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run python -m scripts.seed_admin
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run python -m scripts.seed_catalog
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run python -m scripts.seed_strategies

# 3. Рыночные данные (бенчмарки, FX, CPI — из Лист2 фонды_111-11.xlsx)
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run python -m scripts.seed_market_data

# 4. Котировки фондов для дашборда (расширенный бэктест — из Лист1)
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run python -m scripts.restore_backtest_quotes

# 5. Синтетический Liq (на основе RUSFAR-индекса из market_data_points)
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend uv run python -m scripts.seed_liq

# 6. Котировки для каталога (только с даты инцепшн каждого фонда)
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  psql -U astra -d astra -c "
INSERT INTO fund_catalog_quotes (fund_key, date, price_rub, price_native)
SELECT fq.fund_key, fq.date, fq.price_rub, fq.price_native
FROM fund_quotes fq
JOIN funds f ON f.key = fq.fund_key
WHERE fq.date >= f.inception_date
ON CONFLICT (fund_key, date) DO NOTHING;"
```

Открыть **https://assetallocator.ru** → логин `admin@astra.local` / `admin123`.

## Обновление кода

```bash
# 1. Залить изменения с локальной машины
rsync -avz --exclude node_modules --exclude .git --exclude '.git.old' \
  --exclude '__pycache__' --exclude '.next' --exclude 'backup_*' \
  catalog/ root@VPS_IP:~/catalog/

# 2. Пересобрать и перезапустить изменённые сервисы
cd ~/catalog
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --force-recreate backend frontend
```

## Бэкап БД

```bash
cd ~/catalog
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U astra -Fc astra > backup_$(date +%F_%H%M%S).dump
```

Восстановление из дампа:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_restore -U astra -d astra --clean --if-exists --no-owner < backup_FILE.dump
```

## Безопасность

- `SECRET_KEY`, `POSTGRES_PASSWORD` — случайные, не dev-дефолты.
- Портов наружу нет кроме 80/443 (Caddy).
- `COOKIE_SECURE=true` — куки только по HTTPS.
- 152-ФЗ: политика обработки ПД + уведомление в Роскомнадзор.
