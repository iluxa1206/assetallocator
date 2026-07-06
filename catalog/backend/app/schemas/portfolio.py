"""Portfolio compute request/response schemas."""

from typing import Any

from pydantic import BaseModel, Field


class ExternalAsset(BaseModel):
    """Asset the client already holds outside our management — for whole-portfolio context."""
    name: str = ""
    amount: float = 0.0
    currency: str = "RUB"        # RUB | USD | CNY | GLD
    asset_class: str = "other"   # equity | bond | alternative | cash | realty | other


class ExternalItemOut(BaseModel):
    name: str
    currency: str
    asset_class: str
    base_value: float            # value in base_currency


class PortfolioRequest(BaseModel):
    risk: str = "base"           # base | cons | agg
    ccy: str = "equal"           # rub6040 | equal | val6040 (ignored for base)
    base_currency: str = "RUB"   # RUB | USD | CNY | GLD
    start_date: str | None = None
    end_date: str | None = None
    amount: float = 1_000_000
    amount_ccy: str = "RUB"
    manual: bool = False
    manual_funds: dict[str, float] | None = None
    manual_index_weights: dict[str, float] | None = None
    deposit_term_months: int = 6   # capitalization period for synthetic deposit benchmark
    external_assets: list[ExternalAsset] = Field(default_factory=list)


class MetricsOut(BaseModel):
    total_ret: float
    cagr: float
    vol: float
    max_dd: float
    years: float


class FundComponentOut(BaseModel):
    fund_key: str
    fund_name: str
    native_currency: str
    benchmark: str
    benchmark_label: str
    weight: float             # normalised, sum ≈ 100
    invested_base: float      # invested amount in base_currency
    ended_base: float | None  # ending value in base_currency
    series: list[float] | None
    metrics: MetricsOut | None
    bench_series: list[float] | None
    bench_metrics: MetricsOut | None


class FxRowOut(BaseModel):
    fund_key: str
    fund_name: str
    native_currency: str
    invested: float
    units: float
    fund_return_pct: float
    fund_pnl: float
    fx_delta_pct: float
    fx_effect: float
    total_return_pct: float
    ended: float
    ok: bool


class PortfolioResponse(BaseModel):
    dates: list[str]
    weights: dict[str, float]       # normalised to 100
    portfolio_series: list[float]
    benchmark_series: list[float] | None
    cpi_series: list[float] | None
    deposit_series: list[float] | None
    metrics_portfolio: MetricsOut | None
    metrics_benchmark: MetricsOut | None
    metrics_cpi: MetricsOut | None
    metrics_deposit: MetricsOut | None
    fund_components: list[FundComponentOut]
    fx_decomp: list[FxRowOut]
    currency_breakdown: dict[str, float]
    available_dates: list[str]
    invested_base: float | None     # amount in base_currency at start_date
    ended_base: float | None        # ending portfolio value in base_currency
    # Whole-portfolio context (our funds + client's external assets), values in base_currency.
    external_total_base: float = 0.0
    our_currency_base: dict[str, float] = Field(default_factory=dict)
    our_class_base: dict[str, float] = Field(default_factory=dict)
    external_currency_base: dict[str, float] = Field(default_factory=dict)
    external_class_base: dict[str, float] = Field(default_factory=dict)
    external_items: list[ExternalItemOut] = Field(default_factory=list)
    external_adjusted: bool = False   # fund weights tilted to complement external holdings
