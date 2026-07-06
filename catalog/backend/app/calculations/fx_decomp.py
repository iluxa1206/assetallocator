"""FX attribution decomposition.

Identity (per fund, in investment currency):
    invested + fund_pnl + fx_effect = ended

Derivation:
    invested_native = invested / fx0
    N               = invested_native / p_native0
    ended           = N * p_nativeN * fxN
    fund_pnl        = N * (p_nativeN - p_native0) * fxN
    fx_effect       = invested_native * (fxN - fx0)
    => invested + fund_pnl + fx_effect = ended  ✓
"""

from typing import TypedDict

from .constants import FUND_META
from .fx_rates import fund_price_in_currency, fx_rate
from .types import FundPriceMap, MarketMap


class FxDecompRow(TypedDict):
    fund_key: str
    fund_name: str
    native_currency: str
    invested: float          # amount in investment currency
    units: float             # units purchased
    fund_return_pct: float   # p_nativeN/p_native0 - 1
    fund_pnl: float          # fund P&L in investment currency
    fx_delta_pct: float      # (fxN - fx0) / fx0
    fx_effect: float         # FX effect in investment currency
    total_return_pct: float
    ended: float             # final value in investment currency
    ok: bool


def compute_fx_decomp(
    weights: dict[str, float],
    start_date: str,
    end_date: str,
    amount: float,
    amount_ccy: str,
    base_ccy: str,
    fund_prices: FundPriceMap,
    market: MarketMap,
) -> list[FxDecompRow]:
    """Decompose portfolio return into fund P&L and FX effect, reported in `base_ccy`
    (валюта расчёта). The FX effect for each fund is the gain/loss from converting that
    fund's native currency into the reporting currency. A fund whose native currency
    equals `base_ccy` has zero FX effect."""
    w_total = sum(w for w in weights.values() if w > 0.001)
    rows: list[FxDecompRow] = []

    row0_amt = market.get(start_date)
    # Convert the invested amount from its own currency into the reporting (base) currency.
    amt_to_base0 = fx_rate(amount_ccy, base_ccy, row0_amt) if row0_amt else None
    if not amt_to_base0:
        amt_to_base0 = 1.0

    for key, w in weights.items():
        if w <= 0.001:
            continue
        meta = FUND_META[key]
        native = meta["native_currency"]
        norm_w = w / w_total
        invested = amount * norm_w * amt_to_base0

        p_rub0 = fund_prices.get(key, {}).get(start_date)
        p_rubN = fund_prices.get(key, {}).get(end_date)
        row0 = market.get(start_date)
        rowN = market.get(end_date)

        if p_rub0 is None or p_rubN is None or row0 is None or rowN is None:
            rows.append(_empty_row(key, meta["name"], native, invested))
            continue

        p_native0 = fund_price_in_currency(p_rub0, native, row0)
        p_nativeN = fund_price_in_currency(p_rubN, native, rowN)
        fx0 = fx_rate(native, base_ccy, row0)
        fxN = fx_rate(native, base_ccy, rowN)

        if not p_native0 or p_native0 == 0 or not p_nativeN or fx0 is None or fxN is None:
            rows.append(_empty_row(key, meta["name"], native, invested))
            continue

        invested_native = invested / fx0
        units = invested_native / p_native0
        ended = units * p_nativeN * fxN
        fund_pnl = units * (p_nativeN - p_native0) * fxN
        fx_effect = invested_native * (fxN - fx0)

        fund_return_pct = p_nativeN / p_native0 - 1
        fx_delta_pct = (fxN - fx0) / fx0 if native != base_ccy else 0.0
        total_return_pct = ended / invested - 1

        rows.append(
            FxDecompRow(
                fund_key=key,
                fund_name=meta["name"],
                native_currency=native,
                invested=invested,
                units=units,
                fund_return_pct=fund_return_pct,
                fund_pnl=fund_pnl,
                fx_delta_pct=fx_delta_pct,
                fx_effect=fx_effect,
                total_return_pct=total_return_pct,
                ended=ended,
                ok=True,
            )
        )
    return rows


def _empty_row(key: str, name: str, native: str, invested: float) -> FxDecompRow:
    return FxDecompRow(
        fund_key=key,
        fund_name=name,
        native_currency=native,
        invested=invested,
        units=0.0,
        fund_return_pct=0.0,
        fund_pnl=0.0,
        fx_delta_pct=0.0,
        fx_effect=0.0,
        total_return_pct=0.0,
        ended=0.0,
        ok=False,
    )
