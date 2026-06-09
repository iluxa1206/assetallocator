"""Load DB data → run all calculations → return PortfolioResponse."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.calculations.allocation import compute_allocation, compute_index_weights, get_currency_breakdown
from app.calculations.constants import FUND_META
from app.calculations.cpi import build_cpi_series
from app.calculations.deposit import build_deposit_series
from app.calculations.fx_decomp import compute_fx_decomp
from app.calculations.fx_rates import fx_rate, rub_to_base_rate
from app.calculations.metrics import calc_metrics
from app.calculations.series import build_benchmark_series, build_portfolio_series, find_valid_dates
from app.models.deposit_rate import DepositRateMax10
from app.models.fund import FundQuote
from app.models.market_data import MarketDataPoint
from app.schemas.portfolio import (
    FundComponentOut,
    FxRowOut,
    MetricsOut,
    PortfolioRequest,
    PortfolioResponse,
)


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
    rows = (await session.execute(select(FundQuote).order_by(FundQuote.date))).scalars().all()
    prices: dict = {}
    for r in rows:
        prices.setdefault(r.fund_key, {})[r.date.isoformat()] = r.price_rub
    return prices


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
        fund_prices=fund_prices,
        market=market,
    )
    fx_decomp = [FxRowOut(**r) for r in fx_rows_raw]

    currency_breakdown = get_currency_breakdown(weights)

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
    )
