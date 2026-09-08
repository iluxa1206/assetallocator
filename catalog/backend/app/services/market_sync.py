"""Синк рыночных рядов (`market_data_points`) с MOEX ISS.

Ряды на конец месяца — та же гранулярность, что у таблицы исторически.

**Почему это важнее, чем кажется.** `portfolio_service` строит ось дат дашборда
как `sorted(market.keys())`, то есть глубина всего бэктеста определяется этой
таблицей. Пока рыночные ряды отстают, дашборд не покажет месяцы, за которые
котировки фондов уже загружены.

**Что закрывается автоматически** (сверено с прод-БД на 30.06, совпало до знака):
    rgbitr       ← MOEX RGBITR                754.84
    mcftr        ← MOEX MCFTR                6421.42
    rucnytr_cny  ← MOEX RUCNYTR               117.73
    gldrub       ← MOEX GLDRUB_TOM          10128.50
    usdrub       ← MOEX USD000UTSTOM           79.4125
    cnyrub       ← MOEX CNYRUB_TOM             11.619
    rucnytr_rub  = rucnytr_cny * cnyrub    (проверено на всей истории)
    rusfar       = капитализация ставки RUSFAR (см. ниже)

**Что остаётся ручным** (источник — ежемесячный xlsx):
    cbonds_zo_rub / cbonds_zo_usd — Cbonds, API платный
    cpi_rub / cpi_usd / cpi_cny   — Росстат

Пустые значения безопасны: сборка бенчмарка держит последнее известное
(`series.py`, «hold the last print»), а уровни CPI откатываются к ближайшей
ранней дате (`cpi.py`). Так что неполная строка ничего не роняет — просто
соответствующий ряд стоит на месте до заливки файла.
"""

from __future__ import annotations

import calendar
from datetime import date, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_data import MarketDataPoint

_UA = "Mozilla/5.0 (compatible; AstraCatalog/1.0)"
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)

_INDEX_URL = "https://iss.moex.com/iss/history/engines/stock/markets/index/securities/{secid}.json"
_CURRENCY_URL = (
    "https://iss.moex.com/iss/history/engines/currency/markets/selt/boards/CETS"
    "/securities/{secid}.json"
)
_RUSFAR_URL = (
    "https://iss.moex.com/iss/history/engines/stock/markets/index/boards/MMIX"
    "/securities/RUSFAR.json"
)

# Колонка в market_data_points → (URL-шаблон, secid).
_DIRECT: dict[str, tuple[str, str]] = {
    "rgbitr": (_INDEX_URL, "RGBITR"),
    "mcftr": (_INDEX_URL, "MCFTR"),
    "rucnytr_cny": (_INDEX_URL, "RUCNYTR"),
    "gldrub": (_CURRENCY_URL, "GLDRUB_TOM"),
    "usdrub": (_CURRENCY_URL, "USD000UTSTOM"),
    "cnyrub": (_CURRENCY_URL, "CNYRUB_TOM"),
}


def _month_end(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


async def _fetch_history(
    client: httpx.AsyncClient, url: str, secid: str, since: date, until: date
) -> dict[date, float]:
    """Дневные закрытия за период. Пагинация ISS — по 100 строк."""
    out: dict[date, float] = {}
    start = 0
    while True:
        r = await client.get(
            url.format(secid=secid),
            params={
                "from": since.isoformat(),
                "till": until.isoformat(),
                "start": start,
                "iss.meta": "off",
            },
            headers={"User-Agent": _UA},
        )
        r.raise_for_status()
        block = r.json().get("history", {})
        columns = block.get("columns") or []
        rows = block.get("data") or []
        if not rows:
            break
        i_date = columns.index("TRADEDATE")
        i_close = columns.index("CLOSE") if "CLOSE" in columns else None
        if i_close is None:
            break
        for row in rows:
            value = row[i_close]
            if value is None:
                continue
            out[date.fromisoformat(row[i_date])] = float(value)
        start += len(rows)
    return out


def _month_end_values(daily: dict[date, float], months: list[date]) -> dict[date, float]:
    """Значение на последнюю торговую дату месяца (конец месяца часто выходной)."""
    out: dict[date, float] = {}
    for end in months:
        candidates = [d for d in daily if d.year == end.year and d.month == end.month]
        if candidates:
            out[end] = daily[max(candidates)]
    return out


async def _rusfar_levels(
    client: httpx.AsyncClient, base_date: date, base_value: float, months: list[date]
) -> dict[date, float]:
    """Накопленный индекс денежного рынка из дневной ставки RUSFAR.

    MOEX публикует RUSFAR как ставку в процентах годовых, а в market_data_points
    исторически лежит накопленный индекс — поэтому капитализируем сами, стартуя
    от последнего known значения в базе.

    Соглашение подобрано по трём известным месяцам: база 365, ставка предыдущего
    дня, конечная дата не включается. Средняя ошибка 0.0136% (~0.3 пункта из
    2363). Держать ряд пустым было бы хуже: сборка бенчмарка удерживает последнее
    значение, и денежный рынок показал бы нулевую доходность вместо реальной.
    """
    if not months:
        return {}
    rates = await _fetch_history(client, _RUSFAR_URL, "RUSFAR", base_date, max(months))
    if not rates:
        return {}

    out: dict[date, float] = {}
    level = base_value
    cursor = base_date
    last_rate: float | None = None
    for end in sorted(months):
        while cursor < end:
            last_rate = rates.get(cursor - timedelta(days=1), last_rate)
            if last_rate is not None:
                level *= 1 + last_rate / 100 / 365
            cursor += timedelta(days=1)
        out[end] = round(level, 2)
    return out


async def sync_market_data(session: AsyncSession, today: date | None = None) -> dict[str, int]:
    """Дотягивает рыночные ряды до последнего закрытого месяца.

    Возвращает {колонка: сколько значений записано}. Существующие значения не
    трогаем — заполняем только пустые, чтобы не затирать ручной ввод из xlsx.
    """
    today = today or date.today()

    rows = list((await session.scalars(select(MarketDataPoint))).all())
    by_date = {r.date: r for r in rows}
    if not rows:
        return {}

    # Месяцы от последнего заполненного до последнего закрытого.
    last_known = max(by_date)
    months: list[date] = []
    cursor = _month_end(last_known)
    while True:
        nxt = _month_end(cursor + timedelta(days=1))
        # Месяц берём только когда он закрылся: его последний день уже прошёл.
        if nxt > today:
            break
        months.append(nxt)
        cursor = nxt
    # Плюс уже существующие строки с незаполненными колонками.
    targets = sorted({*months, *(d for d in by_date if d >= last_known - timedelta(days=200))})
    if not targets:
        return {}

    since = min(targets) - timedelta(days=45)
    written: dict[str, int] = {}

    async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
        for column, (url, secid) in _DIRECT.items():
            daily = await _fetch_history(client, url, secid, since, max(targets))
            for when, value in _month_end_values(daily, targets).items():
                row = by_date.get(when)
                if row is None:
                    row = MarketDataPoint(date=when)
                    session.add(row)
                    by_date[when] = row
                if getattr(row, column) is None:
                    setattr(row, column, value)
                    written[column] = written.get(column, 0) + 1

        # Производный ряд: индекс юаневых облигаций в рублях.
        for when, row in by_date.items():
            if when in targets and row.rucnytr_rub is None:
                if row.rucnytr_cny is not None and row.cnyrub is not None:
                    row.rucnytr_rub = row.rucnytr_cny * row.cnyrub
                    written["rucnytr_rub"] = written.get("rucnytr_rub", 0) + 1

        # Денежный рынок: капитализируем от последнего заполненного значения.
        filled = [d for d, r in by_date.items() if r.rusfar is not None]
        if filled:
            anchor = max(filled)
            pending = [d for d in targets if d > anchor and by_date[d].rusfar is None]
            for when, level in (
                await _rusfar_levels(client, anchor, by_date[anchor].rusfar, pending)
            ).items():
                by_date[when].rusfar = level
                written["rusfar"] = written.get("rusfar", 0) + 1

    await session.commit()
    return written
