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

# fund_key → date_str → price_rub
FundPriceMap = dict[str, dict[str, float]]
