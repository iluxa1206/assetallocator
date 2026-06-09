"""Static reference data: fund metadata, allocations, risk profiles, CCY strategies."""

from typing import TypedDict


class FundMeta(TypedDict):
    name: str
    native_currency: str  # RUB | USD | CNY | GLD
    benchmark: str
    benchmark_label: str


FUND_META: dict[str, FundMeta] = {
    "R5":    {"name": "Хедж-фонд Р5",                        "native_currency": "RUB", "benchmark": "RGBITR",       "benchmark_label": "RGBITR"},
    "D5":    {"name": "Хедж-фонд Д5",                        "native_currency": "USD", "benchmark": "CbondsZO_RUB", "benchmark_label": "Cbonds ЗО (RUB)"},
    "Yu5":   {"name": "Хедж-фонд Ю5",                        "native_currency": "CNY", "benchmark": "RUCNYTR_RUB",  "benchmark_label": "RUCNYTR (RUB)"},
    "D1":    {"name": "Хедж-фонд Д1",                        "native_currency": "USD", "benchmark": "CbondsZO_RUB", "benchmark_label": "Cbonds ЗО (RUB)"},
    "VO":    {"name": "Валютные облигации с выплатой дохода", "native_currency": "USD", "benchmark": "CbondsZO_RUB", "benchmark_label": "Cbonds ЗО (RUB)"},
    "Aplus": {"name": "Хедж-фонд А+",                        "native_currency": "RUB", "benchmark": "MCFTR",        "benchmark_label": "MCFTR"},
    "A12080":{"name": "Российские акции 120/80",              "native_currency": "RUB", "benchmark": "MCFTR",        "benchmark_label": "MCFTR"},
    "R1":    {"name": "Облигации Р1",                         "native_currency": "RUB", "benchmark": "RGBITR",       "benchmark_label": "RGBITR"},
    "M3":    {"name": "Хедж-фонд М3",                        "native_currency": "GLD", "benchmark": "GLDRUB",       "benchmark_label": "GLDRUB"},
    "Liq":   {"name": "Фонд денежной ликвидности",            "native_currency": "RUB", "benchmark": "RUSFAR",       "benchmark_label": "RUSFAR"},
}

# Model allocations — weights in percent (sum = 100)
ALLOCATIONS: dict[str, dict] = {
    "base": {"Liq": 10, "M3": 10, "Aplus": 10, "A12080": 10, "R1": 10, "R5": 10, "VO": 10, "D5": 10, "Yu5": 10, "D1": 10},
    "cons": {
        "rub6040": {"Liq": 10, "M3": 10, "Aplus": 5,  "A12080": 10, "R1": 30, "R5": 5,  "VO": 10, "D5": 5,  "Yu5": 5,  "D1": 10},
        "equal":   {"Liq": 10, "M3": 10, "Aplus": 5,  "A12080": 10, "R1": 20, "R5": 5,  "VO": 20, "D5": 5,  "Yu5": 5,  "D1": 10},
        "val6040": {"Liq": 10, "M3": 10, "Aplus": 5,  "A12080": 10, "R1": 10, "R5": 5,  "VO": 30, "D5": 5,  "Yu5": 5,  "D1": 10},
    },
    "agg": {
        "rub6040": {"Liq": 5, "M3": 10, "Aplus": 15, "A12080": 5, "R1": 5, "R5": 30, "VO": 5, "D5": 10, "Yu5": 10, "D1": 5},
        "equal":   {"Liq": 5, "M3": 10, "Aplus": 15, "A12080": 5, "R1": 5, "R5": 20, "VO": 5, "D5": 20, "Yu5": 10, "D1": 5},
        "val6040": {"Liq": 5, "M3": 10, "Aplus": 15, "A12080": 5, "R1": 5, "R5": 10, "VO": 5, "D5": 30, "Yu5": 10, "D1": 5},
    },
}

RISK_PROFILES = {
    "base": {"name": "Базовый",        "desc": "Все фонды поровну, по 10%"},
    "cons": {"name": "Консервативный", "desc": "Сохранение капитала, минимум волатильности"},
    "agg":  {"name": "Агрессивный",    "desc": "Максимизация доходности на горизонте"},
}

CCY_STRATEGIES = {
    "rub6040": {"name": "Рубль 60 / Валюта 40", "rub": 60, "val": 40},
    "equal":   {"name": "Поровну 50 / 50",       "rub": 50, "val": 50},
    "val6040": {"name": "Валюта 60 / Рубль 40",  "rub": 40, "val": 60},
}

INDEX_KEYS = ["RUSFAR", "RGBITR", "MCFTR", "CbondsZO_RUB", "RUCNYTR_RUB", "GLDRUB"]

# Maps benchmark key (used in FUND_META) → DB column name in MarketDataPoint
INDEX_TO_COL: dict[str, str] = {
    "RUSFAR":       "rusfar",
    "RGBITR":       "rgbitr",
    "MCFTR":        "mcftr",
    "CbondsZO_RUB": "cbonds_zo_rub",
    "RUCNYTR_RUB":  "rucnytr_rub",
    "GLDRUB":       "gldrub",
}
