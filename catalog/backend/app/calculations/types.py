"""Shared type aliases for calculation modules."""

from typing import TypedDict


class MarketRow(TypedDict, total=False):
    rusfar: float | None
    rgbitr: float | None
    mcftr: float | None
    cbonds_zo_rub: float | None
    rucnytr_rub: float | None
    gldrub: float | None
    usdrub: float | None
    cnyrub: float | None
    cpi_rub: float | None
    cpi_usd: float | None
    cpi_cny: float | None


# date_str → MarketRow
MarketMap = dict[str, MarketRow]

class FundPrice(TypedDict):
    """NAV of one unit on one date.

    `native` is the official price published in the fund's own currency. It is
    None for RUB funds (where `rub` already is the native price) and for the
    pre-inception backtest stretch, which only ever had a RUB series. Where it
    exists it wins over converting `rub` at the market rate — the two disagree
    because the fund administrator prices at the CBR rate of the NAV date.
    """
    rub: float
    native: float | None


# fund_key → date_str → FundPrice
FundPriceMap = dict[str, dict[str, FundPrice]]
