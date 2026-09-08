"""Синк котировок собственных фондов (ИПИФ) с investfunds.ru.

Отдельно от `competitor_sync` по трём причинам:

1. **Две валютные серии.** Переключатель RUB/валюта фонда на странице меняет не
   `currencyId` (он на выдачу не влияет вовсе), а сам `data_key`, дописывая
   суффикс `_orig_units` — см. `/js/funds.js`:
       if ('otherCurrency' == currency) { data_key = data_key + '_orig_units'; }
   Поэтому цену пая в валюте фонда берём вторым запросом с `pay_orig_units`.
   Для конкурентов всё рублёвое, там хватает одной серии.

2. **Привязка к концу месяца.** investfunds публикует цену днём расчёта пая
   (28–30 число), а наши ряды исторически лежат на последнем календарном дне
   месяца. Без нормализации получили бы по две точки на месяц.

3. **Две таблицы.** Официальные цены идут и в `fund_catalog_quotes` (карточка
   фонда), и в `fund_quotes` (бэктест портфеля).

4. **Ю5 считается отдельно.** По D1/D5/A12080 УК публикует рублёвую цену, и
   investfunds отдаёт её один в один с нашей. По Ю5 публикуется только цена в
   юанях, рубли investfunds считает сам — по курсу ЦБ на день расчёта пая
   (28-30 число). Наша методика (решение от 06.07) — курс ЦБ на конец месяца,
   отсюда расхождение 0.2-0.4%. Поэтому для Ю5 рубли пересчитываем сами.

Сверено с боевой БД до шестого знака: D5 29.06 → rub 1285.32 / native 16.185361,
D1 28.05 → rub 1033.57 / native 14.496073.
"""

from __future__ import annotations

import calendar
import xml.etree.ElementTree as ET
from datetime import date, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fund import Fund, FundCatalogQuote, FundQuote
from app.services.competitor_sync import _TIMEOUT, _UA, fetch_investfunds

# Ряд начинается с даты формирования фонда; якорь заведомо раньше любого из них.
_DEFAULT_SINCE = date(2019, 1, 1)

# Фонды, по которым УК не публикует рублёвую цену: считаем её сами из валютной
# по курсу ЦБ на конец месяца.
_RUB_FROM_NATIVE = {"Yu5"}

_CBR_DAILY = "https://www.cbr.ru/scripts/XML_daily.asp"


async def fetch_cbr_rate(
    client: httpx.AsyncClient, char_code: str, on: date
) -> float | None:
    """Курс ЦБ за единицу валюты на дату.

    ЦБ отдаёт последний установленный курс: на выходной вернётся пятничный, и
    это ровно то, что нужно — курс, действующий в этот день.
    """
    r = await client.get(
        _CBR_DAILY,
        params={"date_req": on.strftime("%d/%m/%Y")},
        headers={"User-Agent": _UA},
    )
    r.raise_for_status()
    root = ET.fromstring(r.content)
    for valute in root.findall("Valute"):
        if valute.findtext("CharCode") == char_code:
            value = float((valute.findtext("Value") or "0").replace(",", "."))
            nominal = int(valute.findtext("Nominal") or 1)
            return value / nominal if nominal else None
    return None


def _month_end(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def _to_month_end(
    points: list[tuple[date, float]], today: date
) -> dict[date, float]:
    """Схлопывает точки в конец месяца, отбрасывая незакрытый текущий месяц.

    Внутри месяца берём последнюю по дате точку — она и есть цена расчёта.
    Незакрытый месяц пропускаем: его «конец месяца» лежал бы в будущем, а сама
    цена ещё не окончательная.
    """
    by_month: dict[tuple[int, int], tuple[date, float]] = {}
    for d, price in points:
        key = (d.year, d.month)
        if key not in by_month or d > by_month[key][0]:
            by_month[key] = (d, price)

    out: dict[date, float] = {}
    for (year, month), (_, price) in by_month.items():
        end = _month_end(date(year, month, 1))
        if end > today:
            continue
        out[end] = price
    return out


async def sync_own_fund(
    session: AsyncSession, fund: Fund, full: bool = False, today: date | None = None
) -> int:
    """Дотягивает котировки одного своего фонда. Возвращает число вставленных строк.

    Инкрементально: от последней сохранённой даты. Пишет в обе таблицы, вставляя
    только отсутствующие даты — руками введённые значения не перетираются.
    """
    if fund.source != "investfunds" or not fund.source_ref:
        return 0

    today = today or date.today()

    last: date | None = None
    if not full:
        last = await session.scalar(
            select(FundCatalogQuote.date)
            .where(FundCatalogQuote.fund_key == fund.key)
            .order_by(FundCatalogQuote.date.desc())
            .limit(1)
        )
    since = last or _DEFAULT_SINCE

    is_native = (fund.native_currency or "RUB") != "RUB"

    async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
        rub_points = await fetch_investfunds(client, fund.source_ref, since)
        native_points = (
            await fetch_investfunds(client, fund.source_ref, since, data_key="pay_orig_units")
            if is_native
            else []
        )

    rub = _to_month_end(rub_points, today)
    native = _to_month_end(native_points, today)

    if fund.key in _RUB_FROM_NATIVE and native:
        # Курс тянем только на недостающие даты — их единицы за прогон.
        existing_dates = set(
            (
                await session.scalars(
                    select(FundCatalogQuote.date).where(
                        FundCatalogQuote.fund_key == fund.key
                    )
                )
            ).all()
        )
        missing = [d for d in sorted(native) if d not in existing_dates]
        if missing:
            async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
                for d in missing:
                    rate = await fetch_cbr_rate(client, fund.native_currency, d)
                    if rate is None:
                        # Без курса рублёвую цену не построить — пропускаем дату,
                        # она подтянется на следующем прогоне.
                        rub.pop(d, None)
                        continue
                    rub[d] = round(native[d] * rate, 2)

    if not rub:
        fund.last_synced_at = datetime.utcnow()
        return 0

    inserted = 0
    for table in (FundCatalogQuote, FundQuote):
        existing = set(
            (
                await session.scalars(
                    select(table.date).where(table.fund_key == fund.key)
                )
            ).all()
        )
        for d in sorted(rub):
            if d in existing:
                continue
            if is_native and d not in native:
                continue
            session.add(
                table(
                    fund_key=fund.key,
                    date=d,
                    price_rub=rub[d],
                    # Для рублёвого фонда native дублирует rub — так же, как в
                    # сидах и в синке конкурентов.
                    price_native=native.get(d) if is_native else rub[d],
                )
            )
            inserted += 1

    fund.last_synced_at = datetime.utcnow()
    await session.flush()
    return inserted


async def sync_all_own_funds(
    session: AsyncSession, full: bool = False
) -> dict[str, int]:
    """Синкает все свои фонды, у которых проставлен источник. -1 = ошибка фонда."""
    funds = list(
        (
            await session.scalars(
                select(Fund).where(Fund.kind == "own", Fund.source == "investfunds")
            )
        ).all()
    )
    result: dict[str, int] = {}
    for fund in funds:
        try:
            result[fund.key] = await sync_own_fund(session, fund, full=full)
        except Exception as exc:  # noqa: BLE001 — падение одного фонда не рвёт остальные
            result[fund.key] = -1
            print(f"[own_fund_sync] {fund.key} failed: {exc!r}")
    await session.commit()
    return result
