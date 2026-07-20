"""Load DB data → run all calculations → return PortfolioResponse."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.calculations.allocation import (
    compute_allocation,
    compute_index_weights,
    get_currency_breakdown,
    tilt_for_external,
)
from app.calculations.constants import FUND_META
from app.calculations.cpi import build_cpi_series
from app.calculations.deposit import build_deposit_series
from app.calculations.fx_decomp import compute_fx_decomp
from app.calculations.fx_rates import fx_rate, rub_to_base_rate
from app.calculations.metrics import calc_metrics
from app.calculations.series import build_benchmark_series, build_portfolio_series, find_valid_dates
from app.models.deposit_rate import DepositRateMax10
from app.models.fund import Fund, FundCatalogQuote, FundQuote
from app.models.market_data import MarketDataPoint
from app.schemas.portfolio import (
    ExternalItemOut,
    FundComponentOut,
    FxRowOut,
    MetricsOut,
    PortfolioRequest,
    PortfolioResponse,
)

# Our fund categories → unified asset class for whole-portfolio breakdown.
_CATEGORY_TO_CLASS = {
    "equities": "equity",
    "bonds": "bond",
    "alternative": "alternative",
    "liquidity": "cash",
}


async def _load_market(session: AsyncSession) -> dict:
    rows = (await session.execute(select(MarketDataPoint).order_by(MarketDataPoint.date))).scalars().all()
    return {
        r.date.isoformat(): {
            "rusfar": r.rusfar, "rgbitr": r.rgbitr, "mcftr": r.mcftr,
            "cbonds_zo_rub": r.cbonds_zo_rub, "cbonds_zo_usd": r.cbonds_zo_usd,
            "rucnytr_rub": r.rucnytr_rub, "rucnytr_cny": r.rucnytr_cny,
            "gldrub": r.gldrub, "usdrub": r.usdrub, "cnyrub": r.cnyrub,
            "cpi_rub": r.cpi_rub, "cpi_usd": r.cpi_usd, "cpi_cny": r.cpi_cny,
        }
        for r in rows
    }


async def _load_fund_prices(session: AsyncSession) -> dict:
    """Fund NAV series, official prices taking precedence over the backtest.

    fund_quotes is a reconstructed series that starts well before most funds
    existed — it is what makes a common 2021 start date possible. fund_catalog_quotes
    holds the prices published from the fund's inception onward, entered by hand
    in the admin UI, and those are the numbers the fund cards show.

    Layering the catalog on top means the dashboard and the fund card quote the
    same figure for any date both cover, and the backtest only supplies the
    stretch before inception, where no official price exists.
    """
    prices: dict = {}
    for r in (await session.execute(select(FundQuote).order_by(FundQuote.date))).scalars().all():
        prices.setdefault(r.fund_key, {})[r.date.isoformat()] = {
            "rub": r.price_rub,
            "native": r.price_native,
        }
    for r in (
        await session.execute(select(FundCatalogQuote).order_by(FundCatalogQuote.date))
    ).scalars().all():
        prices.setdefault(r.fund_key, {})[r.date.isoformat()] = {
            "rub": r.price_rub,
            "native": r.price_native,
        }
    return prices


async def _load_fund_categories(session: AsyncSession) -> dict[str, str]:
    rows = (await session.execute(select(Fund.key, Fund.category))).all()
    return {k: (c or "other") for k, c in rows}


async def _load_deposit_rates(session: AsyncSession) -> list:
    rows = (
        await session.execute(select(DepositRateMax10).order_by(DepositRateMax10.date))
    ).scalars().all()
    return [(r.date, r.rate) for r in rows]


def _to_metrics(m) -> MetricsOut | None:
    if m is None:
        return None
    return MetricsOut(**m)


# CPI key for base_currency
_CPI_COL = {"RUB": "cpi_rub", "USD": "cpi_usd", "CNY": "cpi_cny"}


async def compute_portfolio(req: PortfolioRequest, session: AsyncSession) -> PortfolioResponse:
    market = await _load_market(session)
    fund_prices = await _load_fund_prices(session)
    all_dates = sorted(market.keys())

    weights_raw = compute_allocation(req.risk, req.ccy, req.manual, req.manual_funds)

    # Normalise weights to 100 if manual and not summing to 100
    w_sum = sum(weights_raw.values())
    if req.manual and w_sum > 0 and abs(w_sum - 100) > 0.05:
        weights = {k: v / w_sum * 100 for k, v in weights_raw.items()}
    else:
        weights = dict(weights_raw)

    # ── Model tilt for external holdings ──
    # When the client already holds assets and a currency strategy is active, tilt our
    # funds to complement them so the COMBINED portfolio hits the strategy's RUB/FX target.
    external_adjusted = False
    latest_row = market[all_dates[-1]] if all_dates else None
    if req.external_assets and not req.manual and req.risk != "base" and latest_row:
        amt_rate = fx_rate(req.amount_ccy, req.base_currency, latest_row)
        our_base_now = req.amount * (amt_rate if amt_rate else 1.0)
        ext_rub = 0.0
        ext_fx = 0.0
        for ext in req.external_assets:
            if ext.amount <= 0:
                continue
            r = fx_rate(ext.currency, req.base_currency, latest_row)
            val = ext.amount * (r if r else 1.0)
            if ext.currency == "RUB":
                ext_rub += val
            else:
                ext_fx += val
        weights, external_adjusted = tilt_for_external(
            weights, our_base_now, ext_rub, ext_fx, req.ccy
        )

    # Resolve date range
    start = req.start_date or all_dates[0]
    end = req.end_date or all_dates[-1]

    dates = find_valid_dates(weights, start, end, all_dates, req.base_currency, fund_prices, market)

    portfolio_series = build_portfolio_series(weights, dates, req.base_currency, fund_prices, market) or []
    benchmark_series = build_benchmark_series(
        weights, dates, req.base_currency, market, req.manual_index_weights
    )
    cpi_col = _CPI_COL.get(req.base_currency)
    cpi_series = build_cpi_series(cpi_col, dates, market) if cpi_col else None

    # Deposit benchmark — CBR rates are RUB-only. For non-RUB base we convert the
    # RUB deposit series into base currency via FX, so the line reflects what a
    # foreign-currency investor would have earned by parking funds in a RUB deposit
    # (i.e. the FX P&L is baked in).
    deposit_rates = await _load_deposit_rates(session)
    deposit_series_rub = build_deposit_series(req.deposit_term_months, dates, deposit_rates)
    if deposit_series_rub is None:
        deposit_series = None
    elif req.base_currency == "RUB":
        deposit_series = deposit_series_rub
    else:
        start_row = market.get(dates[0])
        fx_start = rub_to_base_rate(start_row, req.base_currency) if start_row else None
        if not fx_start:
            deposit_series = None
        else:
            converted: list[float] = []
            ok = True
            for i, d in enumerate(dates):
                row = market.get(d)
                fx_t = rub_to_base_rate(row, req.base_currency) if row else None
                if fx_t is None:
                    ok = False
                    break
                converted.append(deposit_series_rub[i] * fx_t / fx_start)
            deposit_series = converted if ok else None

    metrics_port = _to_metrics(calc_metrics(portfolio_series, dates))
    metrics_bench = _to_metrics(calc_metrics(benchmark_series or [], dates)) if benchmark_series else None
    metrics_cpi = _to_metrics(calc_metrics(cpi_series or [], dates)) if cpi_series else None
    metrics_deposit = _to_metrics(calc_metrics(deposit_series or [], dates)) if deposit_series else None

    # Portfolio-level money amounts
    start_row = market.get(dates[0]) if dates else None
    end_row = market.get(dates[-1]) if dates else None

    rate_start = fx_rate(req.amount_ccy, req.base_currency, start_row) if start_row else 1.0
    invested_base = req.amount * (rate_start or 1.0)

    if metrics_port and end_row:
        ended_base = invested_base * (1.0 + metrics_port.total_ret)
    else:
        ended_base = None

    # Per-fund components
    fund_components: list[FundComponentOut] = []
    for key, w in weights.items():
        if w <= 0:
            continue
        meta = FUND_META[key]
        fund_invested_base = invested_base * w / 100.0
        fund_series = build_portfolio_series({key: 100}, dates, req.base_currency, fund_prices, market)
        fund_metrics = _to_metrics(calc_metrics(fund_series, dates)) if fund_series else None
        fund_ended_base = fund_invested_base * (1.0 + fund_metrics.total_ret) if fund_metrics else None

        f_bench_series = build_benchmark_series({key: 100}, dates, req.base_currency, market)
        f_bench_metrics = _to_metrics(calc_metrics(f_bench_series or [], dates)) if f_bench_series else None

        fund_components.append(
            FundComponentOut(
                fund_key=key,
                fund_name=meta["name"],
                native_currency=meta["native_currency"],
                benchmark=meta["benchmark"],
                benchmark_label=meta["benchmark_label"],
                weight=w,
                invested_base=fund_invested_base,
                ended_base=fund_ended_base,
                series=fund_series,
                metrics=fund_metrics,
                bench_series=f_bench_series,
                bench_metrics=f_bench_metrics,
            )
        )

    # FX decomp
    fx_rows_raw = compute_fx_decomp(
        weights=weights,
        start_date=dates[0] if dates else start,
        end_date=dates[-1] if dates else end,
        amount=req.amount,
        amount_ccy=req.amount_ccy,
        base_ccy=req.base_currency,
        fund_prices=fund_prices,
        market=market,
    )
    fx_decomp = [FxRowOut(**r) for r in fx_rows_raw]

    currency_breakdown = get_currency_breakdown(weights)

    # ── Whole-portfolio breakdown: our funds + client's external assets (base ccy) ──
    fund_cats = await _load_fund_categories(session)
    our_currency_base: dict[str, float] = {}
    our_class_base: dict[str, float] = {}
    for comp in fund_components:
        our_currency_base[comp.native_currency] = (
            our_currency_base.get(comp.native_currency, 0.0) + comp.invested_base
        )
        cls = _CATEGORY_TO_CLASS.get(fund_cats.get(comp.fund_key, "other"), "other")
        our_class_base[cls] = our_class_base.get(cls, 0.0) + comp.invested_base

    external_currency_base: dict[str, float] = {}
    external_class_base: dict[str, float] = {}
    external_items: list[ExternalItemOut] = []
    external_total_base = 0.0
    conv_row = end_row or start_row  # value external holdings at the latest available FX
    for ext in req.external_assets:
        if ext.amount <= 0:
            continue
        rate = fx_rate(ext.currency, req.base_currency, conv_row) if conv_row else 1.0
        val = ext.amount * (rate if rate else 1.0)
        external_total_base += val
        external_currency_base[ext.currency] = external_currency_base.get(ext.currency, 0.0) + val
        external_class_base[ext.asset_class] = external_class_base.get(ext.asset_class, 0.0) + val
        external_items.append(ExternalItemOut(
            name=ext.name or "Без названия",
            currency=ext.currency,
            asset_class=ext.asset_class,
            base_value=val,
        ))

    return PortfolioResponse(
        dates=dates,
        weights=weights,
        portfolio_series=portfolio_series,
        benchmark_series=benchmark_series,
        cpi_series=cpi_series,
        deposit_series=deposit_series,
        metrics_portfolio=metrics_port,
        metrics_benchmark=metrics_bench,
        metrics_cpi=metrics_cpi,
        metrics_deposit=metrics_deposit,
        fund_components=fund_components,
        fx_decomp=fx_decomp,
        currency_breakdown=currency_breakdown,
        available_dates=all_dates,
        invested_base=invested_base,
        ended_base=ended_base,
        external_total_base=external_total_base,
        our_currency_base=our_currency_base,
        our_class_base=our_class_base,
        external_currency_base=external_currency_base,
        external_class_base=external_class_base,
        external_items=external_items,
        external_adjusted=external_adjusted,
    )
