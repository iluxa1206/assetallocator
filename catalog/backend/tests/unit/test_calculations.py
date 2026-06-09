"""Unit tests for calculation modules (no DB required)."""

import json
from pathlib import Path

import pytest

from app.calculations.allocation import compute_allocation, compute_index_weights, get_currency_breakdown
from app.calculations.fx_rates import fund_price_in_currency, fx_rate, rub_to_base_rate
from app.calculations.metrics import calc_metrics
from app.calculations.series import build_benchmark_series, build_portfolio_series

# ---------------------------------------------------------------------------
# Minimal market row for FX tests
# ---------------------------------------------------------------------------
ROW = {"usdrub": 80.0, "cnyrub": 11.0, "gldrub": 5000.0}


class TestFxRate:
    def test_same_currency(self):
        assert fx_rate("RUB", "RUB", ROW) == 1.0
        assert fx_rate("USD", "USD", ROW) == 1.0

    def test_rub_to_usd(self):
        assert fx_rate("RUB", "USD", ROW) == pytest.approx(1 / 80.0)

    def test_usd_to_rub(self):
        assert fx_rate("USD", "RUB", ROW) == pytest.approx(80.0)

    def test_usd_to_cny(self):
        assert fx_rate("USD", "CNY", ROW) == pytest.approx(80.0 / 11.0)

    def test_gld_to_rub(self):
        assert fx_rate("GLD", "RUB", ROW) == pytest.approx(5000.0)

    def test_missing_rate_returns_none(self):
        assert fx_rate("RUB", "USD", {}) is None


class TestRubToBaseRate:
    def test_rub(self):
        assert rub_to_base_rate(ROW, "RUB") == 1.0

    def test_usd(self):
        assert rub_to_base_rate(ROW, "USD") == pytest.approx(1 / 80.0)

    def test_cny(self):
        assert rub_to_base_rate(ROW, "CNY") == pytest.approx(1 / 11.0)

    def test_gld(self):
        assert rub_to_base_rate(ROW, "GLD") == pytest.approx(1 / 5000.0)


class TestFundPriceInCurrency:
    def test_rub_passthrough(self):
        assert fund_price_in_currency(1000.0, "RUB", ROW) == 1000.0

    def test_rub_to_usd(self):
        assert fund_price_in_currency(800.0, "USD", ROW) == pytest.approx(800.0 / 80.0)


class TestAllocation:
    def test_base_sums_100(self):
        w = compute_allocation("base", "equal")
        assert sum(w.values()) == pytest.approx(100)

    def test_cons_rub6040_sums_100(self):
        w = compute_allocation("cons", "rub6040")
        assert sum(w.values()) == pytest.approx(100)

    def test_agg_val6040_sums_100(self):
        w = compute_allocation("agg", "val6040")
        assert sum(w.values()) == pytest.approx(100)

    def test_manual_passthrough(self):
        manual = {"R5": 50, "D5": 50}
        w = compute_allocation("base", "equal", manual=True, manual_funds=manual)
        assert w == manual

    def test_index_weights_from_base(self):
        w = compute_allocation("base", "equal")
        idx = compute_index_weights(w)
        assert sum(idx.values()) == pytest.approx(100)

    def test_currency_breakdown_base(self):
        w = compute_allocation("base", "equal")
        ccy = get_currency_breakdown(w)
        # base portfolio: 10 each. RUB funds: Liq+R5+Aplus+A12080+R1 = 50%
        assert ccy["RUB"] == pytest.approx(50)
        assert ccy["USD"] == pytest.approx(30)  # D5+D1+VO
        assert ccy["CNY"] == pytest.approx(10)  # Yu5
        assert ccy["GLD"] == pytest.approx(10)  # M3


class TestMetrics:
    def test_flat_series(self):
        import datetime
        series = [100.0] * 13
        dates = [datetime.date(2022 + i // 12, i % 12 + 1, 28).isoformat() for i in range(13)]
        m = calc_metrics(series, dates)
        assert m is not None
        assert m["total_ret"] == pytest.approx(0.0)
        assert m["cagr"] == pytest.approx(0.0)
        assert m["vol"] == pytest.approx(0.0)
        assert m["max_dd"] == pytest.approx(0.0)

    def test_growing_series(self):
        import datetime
        n = 25
        series = [100.0 * (1.01**i) for i in range(n)]
        base = datetime.date(2021, 12, 31)
        dates = []
        for i in range(n):
            m = base.month + i
            year = base.year + (m - 1) // 12
            month = (m - 1) % 12 + 1
            dates.append(datetime.date(year, month, 28).isoformat())
        m = calc_metrics(series, dates)
        assert m is not None
        assert m["total_ret"] > 0
        assert m["cagr"] > 0
        assert m["max_dd"] == pytest.approx(0.0)

    def test_drawdown_detected(self):
        series = [100.0, 110.0, 90.0, 95.0]
        dates = ["2022-01-31", "2022-02-28", "2022-03-31", "2022-04-30"]
        m = calc_metrics(series, dates)
        assert m is not None
        assert m["max_dd"] == pytest.approx(90 / 110 - 1, abs=1e-6)

    def test_too_short_returns_none(self):
        assert calc_metrics([100.0], ["2022-01-31"]) is None
        assert calc_metrics([], []) is None


# ---------------------------------------------------------------------------
# Integration-style: test against expected_vectors.json (DB not needed)
# Vectors are pre-computed and committed. We rebuild from fixture data.
# ---------------------------------------------------------------------------
VECTORS_PATH = Path(__file__).parent.parent.parent / "expected_vectors.json"


@pytest.fixture(scope="module")
def vectors():
    if not VECTORS_PATH.exists():
        pytest.skip("expected_vectors.json not found — run generate_test_vectors.py first")
    return json.loads(VECTORS_PATH.read_text())


class TestFxDecompVectors:
    def test_fund_pnl_matches_reference(self, vectors):
        v = vectors.get("fx_decomp_d5_500k_rub")
        if v is None:
            pytest.skip("fx_decomp vector missing")
        assert v["fund_pnl"] == pytest.approx(v["ref_fund_pnl"], abs=0.05)

    def test_fx_effect_matches_reference(self, vectors):
        v = vectors.get("fx_decomp_d5_500k_rub")
        if v is None:
            pytest.skip("fx_decomp vector missing")
        assert v["fx_effect"] == pytest.approx(v["ref_fx_effect"], abs=0.05)

    def test_identity_holds(self, vectors):
        v = vectors.get("fx_decomp_d5_500k_rub")
        if v is None:
            pytest.skip("fx_decomp vector missing")
        assert v["identity_check"] == pytest.approx(0.0, abs=1e-4)
