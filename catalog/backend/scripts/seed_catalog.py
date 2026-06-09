"""Seed Fund catalog from Astra UA presentation (30.04.2026) + fees table.

Idempotent: upsert by `key`. Reads CATALOG list, applies INSERT or UPDATE.

Run:
    DATABASE_URL=postgresql+asyncpg://astra:astra_dev@localhost:5434/astra \
        .venv/bin/python -m scripts.seed_catalog
"""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.models.fund import Fund


# Common Russian hedge-fund redemption discount pattern: 2% Y1, 1% Y2, then 0
HF_DISCOUNT = {"redemption_discount_y1": 2.0, "redemption_discount_y2": 1.0}
NO_DISCOUNT = {"redemption_discount_y1": 0.0, "redemption_discount_y2": 0.0}


def flat_tier(mf: float, sf: float | None, hurdle: str | None = None) -> list[dict[str, Any]]:
    """Same fee across all 5 ticket-size tiers."""
    tiers = ["<3m", "3m+", "5m+", "10m+", "30m+"]
    return [{"tier": t, "mf": mf, "sf": sf, "hurdle": hurdle} for t in tiers]


def tiered(rows: list[tuple[float, float | None]], hurdle: str | None = None) -> list[dict[str, Any]]:
    """Build tiers from list of (mf, sf) per tier in order."""
    tiers = ["<3m", "3m+", "5m+", "10m+", "30m+"]
    return [{"tier": t, "mf": mf, "sf": sf, "hurdle": hurdle} for t, (mf, sf) in zip(tiers, rows, strict=True)]


CATALOG: list[dict[str, Any]] = [
    # ──────────────── EQUITIES — ДУ ────────────────
    {
        "key": "RusEqDU",
        "name": "Российские акции",
        "short_name": "Российские акции",
        "category": "equities",
        "contract_type": "ДУ",
        "native_currency": "RUB",
        "benchmark": "MCFTR",
        "benchmark_label": "MCFTR",
        "inception_date": date(2022, 5, 6),
        "manager_name": "Николай Василенко",
        "target_yield": "30-35% (gross)",
        "horizon": "От трёх лет",
        "risk_score": 5,
        "liquidity_label": "Высокая",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "25 млн ₽",
        "logistics": "₽ в НРД",
        "strategy_goal": (
            "Высокая абсолютная доходность в рублях на инвестиционном горизонте от трёх лет. "
            "Стратегия не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Стратегия предусматривает инвестирование в акции публичных российских компаний "
            "средней и крупной капитализации, торгующихся на Московской бирже. При включении "
            "акций в портфель управляющий предпочитает: частные компании с сильным корпоративным "
            "управлением; растущий и устойчивый профиль бизнеса; бенефициаров трансформации "
            "структуры российской экономики. Стратегия рассчитана на квалифицированных инвесторов, "
            "толерантных к высокому уровню риска."
        ),
        "why_bullets": None,
        "mgmt_fee_tiers": tiered([(2.0, 20.0), (1.75, 15.0), (1.5, 15.0), (1.0, 10.0), (1.0, 10.0)]),
        **NO_DISCOUNT,
        "extra_expenses": None,
        "hwm": False,
        "risks": [
            {"name": "Рыночный риск", "severity": "Высокий", "description": "Изменение стоимости ценных бумаг."},
            {"name": "Риск ликвидности", "severity": "Средний", "description": "Низкая ликвидность рынка или остановка торгов."},
            {"name": "Кредитный риск", "severity": "Низкий", "description": "Банкротство эмитента — цена акций может упасть до нуля."},
            {"name": "Инфраструктурный риск", "severity": "Низкий", "description": "Сбои биржевой инфраструктуры."},
        ],
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Акции", "issuer": "ДОМ.РФ", "weight": "48,97%"},
            {"instrument": "Акции", "issuer": "Озон", "weight": "14,25%"},
            {"instrument": "Акции", "issuer": "РусГидро", "weight": "9,03%"},
            {"instrument": "Акции", "issuer": "МКПАО ЮМГ", "weight": "8,25%"},
            {"instrument": "Акции", "issuer": "B2B-РТС", "weight": "5,63%"},
        ],
        "sort_order": 10,
    },
    {
        "key": "IpoSpo",
        "name": "Российские IPO/SPO",
        "short_name": "Российские IPO/SPO",
        "category": "equities",
        "contract_type": "ДУ",
        "native_currency": "RUB",
        "benchmark": "MCFTR",
        "benchmark_label": "MCFTR",
        "inception_date": date(2023, 11, 30),
        "manager_name": "Николай Василенко",
        "target_yield": "20-25% (gross)",
        "horizon": "От одного года",
        "risk_score": 5,
        "liquidity_label": "Высокая",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "25 млн ₽",
        "logistics": "₽ в НРД",
        "strategy_goal": (
            "Высокая абсолютная доходность в рублях. Складывается из доходности денежного рынка "
            "(РЕПО, основная часть) и доходности от участия в IPO/SPO с последующей продажей "
            "в первые недели торгов (дополнительная часть)."
        ),
        "description": (
            "Стратегия предусматривает размещение средств на денежном рынке (РЕПО), а также — "
            "в качестве дополнительного дохода — участие в сделках по первичным (IPO) и "
            "вторичным (SPO) размещениям акций российских эмитентов. Управляющий участвует "
            "в размещениях с наибольшим потенциалом роста в первые дни торгов, основываясь на "
            "критериях: высокая «переподписка», небольшой объём размещения, высокое качество "
            "корпоративного управления и финансовое положение эмитента."
        ),
        "why_bullets": None,
        "mgmt_fee_tiers": flat_tier(1.0, 20.0),
        **NO_DISCOUNT,
        "extra_expenses": "Success fee взимается только с прибыли от участия в IPO/SPO.",
        "hwm": False,
        "risks": [
            {"name": "Риск аллокации", "severity": "Высокий", "description": "Фактическая аллокация в сделке IPO/SPO может быть ниже ожидаемой."},
            {"name": "Рыночный риск", "severity": "Средний", "description": "Изменение стоимости ценных бумаг."},
            {"name": "Риск изменения параметров сделки", "severity": "Средний", "description": "Параметры сделки могут измениться без возможности отмены заявки."},
            {"name": "Инфраструктурный риск", "severity": "Минимальный", "description": "Банкротство Московской биржи."},
        ],
        "sort_order": 20,
    },
    {
        "key": "A12080",
        "name": "Российские акции 120/80",
        "short_name": "Российские акции 120/80",
        "category": "equities",
        "contract_type": "ИПИФ",
        "native_currency": "RUB",
        "benchmark": "MCFTR",
        "benchmark_label": "MCFTR",
        "inception_date": date(2024, 9, 10),
        "manager_name": "Николай Василенко",
        "target_yield": "25-30% (net)",
        "horizon": "От трёх лет",
        "risk_score": 5,
        "liquidity_label": "Ежемесячная",
        "interval_label": "Последние пять рабочих дней каждого месяца",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "1 млн ₽",
        "logistics": "₽ в ГПБ",
        "strategy_goal": (
            "Высокая относительная доходность, превышающая доходность индекса Мосбиржи полной доходности (MCFTR) "
            "на горизонте трёх лет. Стратегия не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Фонд предусматривает инвестирование в акции публичных российских компаний, "
            "торгующихся на Московской бирже. При включении акций в портфель управляющий предпочитает: "
            "частные компании с сильным корпоративным управлением; растущий и устойчивый профиль бизнеса; "
            "катализатор переоценки акций на горизонте недель/месяцев (дивиденды, финрезультаты, корпдействия)."
        ),
        "why_bullets": [
            "Анализ и отбор качественных инвестиционных идей (нет идеи = нет позиции).",
            "Высокая концентрация в отдельных идеях (vs максимум 10-15% у большинства ОПИФ).",
            "Эффективная система комиссии за успех (SF) — взимается только с доходности, превышающей MCFTR.",
            "Дополнительная доходность за счёт «тайминга» рынка (макс. доля денежных средств 20%, заёмных — 20%).",
        ],
        "mgmt_fee_tiers": flat_tier(1.0, 30.0, hurdle="MCFTR"),
        **NO_DISCOUNT,
        "extra_expenses": "Спецдеп / Регистратор / Оценщик — не более 0,5%. Надбавки и скидки отсутствуют.",
        "hwm": True,
        "risks": [
            {"name": "Рыночный риск", "severity": "Высокий", "description": "Изменение стоимости ценных бумаг."},
            {"name": "Риск ликвидности", "severity": "Средний", "description": "Низкая ликвидность рынка или остановка торгов."},
            {"name": "Кредитный риск", "severity": "Низкий", "description": "Банкротство эмитента."},
            {"name": "Инфраструктурный риск", "severity": "Низкий", "description": "Сбои биржевой инфраструктуры."},
        ],
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Акции", "issuer": "ДОМ.РФ", "weight": "49,79%"},
            {"instrument": "Акции", "issuer": "Озон", "weight": "13,78%"},
            {"instrument": "Акции", "issuer": "МКПАО ЮМГ", "weight": "9,44%"},
            {"instrument": "Акции", "issuer": "РусГидро", "weight": "8,86%"},
            {"instrument": "Акции", "issuer": "ЯНДЕКС", "weight": "7,15%"},
        ],
        "fund_rules_no": "№ 6352-СД от 23.07.2024",
        "sort_order": 30,
    },
    # ──────────────── BONDS ────────────────
    {
        "key": "RusBondDU",
        "name": "Российские облигации",
        "short_name": "Российские облигации",
        "category": "bonds",
        "contract_type": "ДУ",
        "native_currency": "RUB",
        "benchmark": "RGBITR",
        "benchmark_label": "RGBITR",
        "inception_date": date(2022, 7, 19),
        "manager_name": "Дмитрий Гаврилин",
        "target_yield": "18-20% (gross)",
        "horizon": "От двух лет",
        "risk_score": 3,
        "liquidity_label": "Высокая",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Неквал",
        "min_check": "25 млн ₽",
        "logistics": "₽ в НРД",
        "strategy_goal": (
            "Высокая абсолютная доходность в рублях на инвестиционном горизонте от двух лет. "
            "Не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Надёжный способ инвестирования в российские рублёвые облигации с акцентом на "
            "сохранение капитала и получение стабильного дохода. Для инвесторов, предпочитающих "
            "консервативные решения, при этом в стратегии могут использоваться спекулятивные возможности. "
            "Активы могут размещаться в ОФЗ и корпоративные облигации с плавающим и фиксированным купоном, "
            "а также в бумаги с индексируемым на инфляцию номиналом для защиты от инфляционных шоков."
        ),
        "why_bullets": None,
        "mgmt_fee_tiers": tiered([(1.0, None), (0.75, None), (0.5, None), (0.5, None), (0.5, None)]),
        **NO_DISCOUNT,
        "extra_expenses": None,
        "hwm": False,
        "risks": [
            {"name": "Процентный (рыночный) риск", "severity": "Высокий", "description": "Изменение уровня процентных ставок. Допускается высокая дюрация."},
            {"name": "Кредитный риск эмитентов", "severity": "Средний", "description": "Возможна потеря капитала при дефолте."},
        ],
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Облигации", "issue": "ТрансКо2Р1", "coupon": "КС + 1,75%", "maturity": "2027"},
            {"instrument": "Облигации", "issue": "sВЭБР-39", "coupon": "RUONIA + 1,45%", "maturity": "2030"},
            {"instrument": "Облигации", "issue": "Росагр1Р5", "coupon": "RUONIA + 1,80%", "maturity": "2029"},
            {"instrument": "Облигации", "issue": "ЕАБР П3-07", "coupon": "RUONIA + 2,00%", "maturity": "2028"},
            {"instrument": "Облигации", "issue": "ВЭБР-36", "coupon": "RUONIA + 1,70%", "maturity": "2030"},
        ],
        "sort_order": 40,
    },
    {
        "key": "R1",
        "name": "Облигации Р1",
        "short_name": "Облигации Р1",
        "category": "bonds",
        "contract_type": "ИПИФ",
        "native_currency": "RUB",
        "benchmark": "RGBITR",
        "benchmark_label": "RGBITR",
        "inception_date": date(2025, 3, 12),
        "manager_name": "Дмитрий Гаврилин",
        "target_yield": "20-25% (net)",
        "horizon": "От двух лет",
        "risk_score": 3,
        "liquidity_label": "Ежемесячная",
        "interval_label": "Последние пять рабочих дней каждого месяца",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "1 млн ₽",
        "logistics": "₽ в ГПБ",
        "strategy_goal": (
            "Высокая рублёвая доходность сбалансированного портфеля облигаций на горизонте двух лет. "
            "Фонд не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Активно управляемый фонд, реализующий макроэкономический подход к управлению портфелем "
            "на рынке российских облигаций. Ориентирован на активное управление дюрацией и структурой "
            "портфеля. Основу составляют государственные и корпоративные облигации с высоким "
            "кредитным качеством."
        ),
        "why_bullets": [
            "Структура и сбалансированный подход — для рублёвых долгосрочных инвестиций.",
            "Быстрая адаптация к изменениям макроэкономической ситуации.",
            "Отсутствие заёмных средств снижает рыночные риски и обеспечивает устойчивость доходности.",
        ],
        "mgmt_fee_tiers": flat_tier(1.0, 10.0),
        **NO_DISCOUNT,
        "extra_expenses": "Спецдеп / Регистратор / Оценщик — не более 1,5%. Скидки при погашении 0%.",
        "hwm": True,
        "risks": [
            {"name": "Процентный (рыночный) риск", "severity": "Высокий", "description": "Изменение ставок; допускается высокая дюрация. Контроль — сокращение дюрации."},
            {"name": "Кредитный риск", "severity": "Средний", "description": "Высокое кредитное качество; возможна потеря при дефолте."},
            {"name": "Риск инфраструктуры", "severity": "Средний", "description": "Изменения риск-параметров Мосбиржи могут требовать сокращения портфеля."},
        ],
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Облигации", "issue": "ОФЗ 26250", "coupon": "12,00%", "maturity": "2037"},
            {"instrument": "Облигации", "issue": "ОФЗ 26254", "coupon": "13,00%", "maturity": "2040"},
            {"instrument": "Облигации", "issue": "ОФЗ 26248", "coupon": "12,25%", "maturity": "2040"},
            {"instrument": "Облигации", "issue": "ОФЗ 26253", "coupon": "13,00%", "maturity": "2038"},
            {"instrument": "Облигации", "issue": "ОФЗ 26247", "coupon": "12,25%", "maturity": "2039"},
        ],
        "fund_rules_no": "№ 6859-СД от 12.03.2025",
        "sort_order": 50,
    },
    {
        "key": "VO",
        "name": "Валютные облигации с выплатой дохода",
        "short_name": "Валютные облигации",
        "category": "bonds",
        "contract_type": "ИПИФ",
        "native_currency": "USD",
        "benchmark": "CbondsZO_RUB",
        "benchmark_label": "Cbonds ЗО (RUB)",
        "inception_date": date(2023, 11, 1),
        "manager_name": "Тамерлан Урумов",
        "target_yield": "6-8% (net)",
        "horizon": "От двух лет",
        "risk_score": 3,
        "liquidity_label": "Ежемесячная",
        "interval_label": "Последние пять рабочих дней каждого месяца",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "1 млн ₽",
        "logistics": "₽ в ГПБ",
        "strategy_goal": (
            "Высокая абсолютная долларовая доходность на инвестиционном горизонте от двух лет. "
            "Фонд не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Инвестирование в диверсифицированный портфель замещающих облигаций, "
            "номинированных в долларах США, торгующихся на Московской бирже. Целевая доходность "
            "состоит из выплат купонного дохода и роста цен облигаций. Весь купонный доход "
            "за календарный квартал распределяется среди пайщиков. Управляющий поддерживает среднюю "
            "дюрацию, постепенно избавляясь от коротких бумаг и покупая более доходные выпуски."
        ),
        "why_bullets": [
            "Валютная доходность без инфраструктурных рисков.",
            "Отсутствие курсовой переоценки по сделкам внутри фонда.",
            "Регулярные ежеквартальные выплаты купонного дохода.",
            "Конвертация валюты внутри фонда по биржевым котировкам.",
        ],
        "mgmt_fee_tiers": flat_tier(1.0, None),
        **NO_DISCOUNT,
        "extra_expenses": "Спецдеп / Регистратор / Оценщик — не более 0,5%. Скидки — нет.",
        "hwm": False,
        "risks": [
            {"name": "Процентный (рыночный) риск", "severity": "Высокий", "description": "Изменение процентных ставок."},
            {"name": "Кредитный риск", "severity": "Средний", "description": "Возможна потеря при дефолте эмитентов."},
            {"name": "Валютный риск", "severity": "Средний", "description": "Конвертация внутри фонда может проходить с задержкой; фонд номинирован в RUB."},
        ],
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Облигации", "issue": "ГазКЗ-29Д", "coupon": "2,95%", "maturity": "2029"},
            {"instrument": "Облигации", "issue": "НОВАТЭК1Р2", "coupon": "6,25%", "maturity": "2029"},
            {"instrument": "Облигации", "issue": "МЕТАЛИН028", "coupon": "3,38%", "maturity": "2028"},
            {"instrument": "Облигации", "issue": "Полюс Б1Р4", "coupon": "6,20%", "maturity": "2029"},
            {"instrument": "Облигации", "issue": "СКФ 3О2028", "coupon": "3,85%", "maturity": "2028"},
        ],
        "fund_rules_no": "№ 5711-СД от 13.10.2023",
        "sort_order": 60,
    },
    {
        "key": "BHIntl",
        "name": "Международные облигации (B&H)",
        "short_name": "Международные облигации",
        "category": "bonds",
        "contract_type": "Advisory",
        "native_currency": "USD",
        "benchmark": "",
        "benchmark_label": "",
        "manager_name": "Максим Литвинов",
        "target_yield": "5-7% (gross)",
        "horizon": "От двух лет",
        "risk_score": 3,
        "liquidity_label": None,
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "2 млн USD",
        "logistics": "n/a",
        "strategy_goal": None,
        "description": (
            "Advisory-стратегия на международном рынке облигаций (buy & hold). "
            "Для квалифицированных инвесторов с минимальным чеком от 2 млн долларов США."
        ),
        "why_bullets": None,
        "mgmt_fee_tiers": tiered([(1.0, None), (1.0, None), (0.75, None), (0.5, None), (0.35, None)]),
        **NO_DISCOUNT,
        "extra_expenses": None,
        "hwm": False,
        "sort_order": 70,
    },
    {
        "key": "Multi402040",
        "name": "Мульти-активный подход (USD UCITS 40-20-40)",
        "short_name": "Мульти-актив 40-20-40",
        "category": "alternative",
        "contract_type": "Advisory",
        "native_currency": "USD",
        "benchmark": "",
        "benchmark_label": "",
        "manager_name": "Максим Литвинов",
        "target_yield": "5-10% (gross)",
        "horizon": "От двух лет",
        "risk_score": 3,
        "liquidity_label": None,
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "2 млн USD",
        "logistics": "n/a",
        "strategy_goal": None,
        "description": (
            "Аллокация активов в долларовом портфеле UCITS по модели 40/20/40. "
            "Advisory-стратегия для квалифицированных инвесторов."
        ),
        "why_bullets": None,
        "mgmt_fee_tiers": tiered(
            [(1.0, 20.0), (1.0, 20.0), (0.75, 20.0), (0.5, 20.0), (0.35, 20.0)],
            hurdle="Модельный микс 40-20-40",
        ),
        **NO_DISCOUNT,
        "extra_expenses": None,
        "hwm": False,
        "sort_order": 80,
    },
    # ──────────────── ALTERNATIVE / HEDGE FUNDS ────────────────
    {
        "key": "R5",
        "name": "Хедж-фонд Р5",
        "short_name": "Хедж-фонд Р5",
        "category": "alternative",
        "contract_type": "ИПИФ",
        "native_currency": "RUB",
        "benchmark": "RGBITR",
        "benchmark_label": "RGBITR",
        "isin": "RU000A105153",
        "inception_date": date(2022, 5, 5),
        "manager_name": "Дмитрий Гаврилин",
        "target_yield": "25-35% (net)",
        "horizon": "От двух лет",
        "risk_score": 5,
        "liquidity_label": "Ежемесячная",
        "interval_label": "Последние пять рабочих дней каждого месяца",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "1 млн ₽",
        "logistics": "₽ в ГПБ",
        "strategy_goal": (
            "Высокая абсолютная рублёвая доходность на инвестиционном горизонте от двух лет. "
            "Фонд не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Макро-фонд: стратегия основывается на анализе и прогнозировании изменений "
            "макроэкономической среды, денежно-кредитной политики и динамики цен на облигации. "
            "Активное управление структурой и дюрацией портфеля, открытие «длинных» и «коротких» позиций, "
            "арбитраж на процентных ставках, использование заёмных средств. Фонд инвестирует на рынке "
            "российских рублёвых облигаций."
        ),
        "why_bullets": [
            "Оригинальная стратегия — устойчиво высокий результат на различных стадиях рыночного цикла.",
            "Широкий мандат — позиции, отличные от консенсуса.",
            "Глубокий макроэкономический анализ в основе позиционирования.",
            "Допускается открытие «коротких» позиций для хеджирования и снижения просадок.",
            "Доступ к рынку фондирования на условиях институциональных инвесторов.",
            "Команда управляющих с 15-летним совместным треком.",
        ],
        "mgmt_fee_tiers": flat_tier(1.5, 20.0),
        **HF_DISCOUNT,
        "extra_expenses": "Спецдеп / Регистратор / Оценщик — не более 0,2%.",
        "hwm": True,
        "risks": [
            {"name": "Процентный (рыночный) риск", "severity": "Высокий", "description": "Изменение ставок; реализуется как при росте, так и снижении. Высокая дюрация + заёмные средства."},
            {"name": "Кредитный риск", "severity": "Средний", "description": "Государственные и наиболее надёжные корпоративные облигации."},
            {"name": "Риск инфраструктуры", "severity": "Средний", "description": "Изменение риск-параметров Мосбиржи."},
            {"name": "Риск дефицита фондирования", "severity": "Средний", "description": "Возможность использования заёмных средств; решение — сокращение доли заёмных."},
        ],
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Облигации", "issue": "ОФЗ 26247", "coupon": "12,25%", "maturity": "2039"},
            {"instrument": "Облигации", "issue": "ОФЗ 26248", "coupon": "12,25%", "maturity": "2040"},
            {"instrument": "Облигации", "issue": "ОФЗ 26246", "coupon": "12,00%", "maturity": "2036"},
            {"instrument": "Облигации", "issue": "ОФЗ 26254", "coupon": "13,00%", "maturity": "2040"},
            {"instrument": "Облигации", "issue": "ВЭБР-40", "coupon": "RUONIA + 1,40%", "maturity": "2032"},
        ],
        "fund_rules_no": "№ 4853-СД от 21.02.2022",
        "sort_order": 90,
    },
    {
        "key": "D5",
        "name": "Хедж-фонд Д5",
        "short_name": "Хедж-фонд Д5",
        "category": "alternative",
        "contract_type": "ИПИФ",
        "native_currency": "USD",
        "benchmark": "CbondsZO_RUB",
        "benchmark_label": "Cbonds ЗО (RUB)",
        "isin": "RU000A106MG3",
        "inception_date": date(2023, 4, 19),
        "manager_name": "Дмитрий Гаврилин",
        "target_yield": "15-25% (net)",
        "horizon": "От двух лет",
        "risk_score": 5,
        "liquidity_label": "Ежемесячная",
        "interval_label": "Последние пять рабочих дней каждого месяца",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "1 млн ₽",
        "logistics": "₽ в ГПБ",
        "strategy_goal": (
            "Высокая абсолютная долларовая доходность на инвестиционном горизонте от двух лет. "
            "Не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Макро-фонд. «Ядро» из валютных облигаций + торговые и арбитражные идеи на рынке "
            "рублёвых облигаций. Допустимо использование заёмных средств."
        ),
        "why_bullets": [
            "Устойчиво высокий результат на различных стадиях рыночного цикла.",
            "Номинирован в USD, использует возможности долларового и рублёвого рынков облигаций.",
            "Широкий мандат, отличные от консенсуса позиции.",
            "«Короткие» позиции для хеджирования.",
            "Институциональные условия фондирования.",
            "15-летний совместный трек команды.",
        ],
        "mgmt_fee_tiers": flat_tier(1.5, 20.0),
        **HF_DISCOUNT,
        "extra_expenses": "Спецдеп / Регистратор / Оценщик — не более 0,2%.",
        "hwm": True,
        "risks": [
            {"name": "Процентный (рыночный) риск", "severity": "Высокий", "description": "Изменение ставок; «короткие» позиции, высокая дюрация и заёмные средства."},
            {"name": "Кредитный риск", "severity": "Средний", "description": "Высокое кредитное качество, но возможна потеря при дефолте."},
            {"name": "Риск инфраструктуры", "severity": "Средний", "description": "Санкции на биржевую инфраструктуру → принудительная конвертация в RUB, блокировка валютных остатков."},
            {"name": "Риск дефицита фондирования", "severity": "Средний", "description": "Заёмные средства через РЕПО."},
            {"name": "Валютный риск", "severity": "Средний", "description": "Конвертация может проходить с задержкой; фонд номинирован в RUB."},
        ],
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Облигации", "issue": "ОФЗ 26247", "coupon": "12,25%", "maturity": "2039"},
            {"instrument": "Облигации", "issue": "ОФЗ 26246", "coupon": "12,00%", "maturity": "2036"},
            {"instrument": "Облигации", "issue": "ГазКЗ-30Д", "coupon": "3,25%", "maturity": "2030"},
            {"instrument": "Облигации", "issue": "ГазКап3Р14", "coupon": "7,25%", "maturity": "2029"},
            {"instrument": "Облигации", "issue": "ВЭБР-40", "coupon": "RUONIA + 1,40%", "maturity": "2032"},
        ],
        "fund_rules_no": "№ 5314-СД от 23.03.2023",
        "sort_order": 100,
    },
    {
        "key": "Yu5",
        "name": "Хедж-фонд Ю5",
        "short_name": "Хедж-фонд Ю5",
        "category": "alternative",
        "contract_type": "ИПИФ",
        "native_currency": "CNY",
        "benchmark": "RUCNYTR_RUB",
        "benchmark_label": "RUCNYTR (RUB)",
        "isin": "RU000A107860",
        "inception_date": date(2023, 4, 19),
        "manager_name": "Дмитрий Гаврилин",
        "target_yield": "15-25% (net)",
        "horizon": "От двух лет",
        "risk_score": 5,
        "liquidity_label": "Ежемесячная",
        "interval_label": "Последние пять рабочих дней каждого месяца",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "1 млн ₽",
        "logistics": "₽ в ГПБ",
        "strategy_goal": (
            "Высокая абсолютная доходность в юанях на инвестиционном горизонте от двух лет. "
            "Не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Макро-фонд. «Ядро» из облигаций, номинированных в юанях, + торговые и арбитражные идеи "
            "на рынке рублёвых облигаций. Допустимо использование заёмных средств."
        ),
        "why_bullets": [
            "Устойчиво высокий результат на различных стадиях рыночного цикла.",
            "Номинирован в юанях; возможности юаневого и рублёвого рынков облигаций.",
            "Широкий мандат, отличные от консенсуса позиции.",
            "«Короткие» позиции для хеджирования.",
            "Институциональные условия фондирования.",
            "15-летний совместный трек команды.",
        ],
        "mgmt_fee_tiers": flat_tier(1.5, 20.0),
        **HF_DISCOUNT,
        "extra_expenses": "Спецдеп / Регистратор / Оценщик — не более 0,2%.",
        "hwm": True,
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Облигации", "issue": "ОФЗ 26248", "coupon": "12,25%", "maturity": "2040"},
            {"instrument": "Облигации", "issue": "ОФЗ 26247", "coupon": "12,25%", "maturity": "2039"},
            {"instrument": "Облигации", "issue": "РЖД 1Р-51R", "coupon": "7,60%", "maturity": "2029"},
            {"instrument": "Облигации", "issue": "МЕТАЛИНР12", "coupon": "10,20%", "maturity": "2027"},
            {"instrument": "Облигации", "issue": "ВЭБР-40", "coupon": "RUONIA + 1,40%", "maturity": "2032"},
        ],
        "fund_rules_no": "№ 5313-СД от 23.03.2023",
        "sort_order": 110,
    },
    {
        "key": "D1",
        "name": "Хедж-фонд Д1",
        "short_name": "Хедж-фонд Д1",
        "category": "alternative",
        "contract_type": "ИПИФ",
        "native_currency": "USD",
        "benchmark": "CbondsZO_RUB",
        "benchmark_label": "Cbonds ЗО (RUB)",
        "isin": "RU000A1079J5",
        "inception_date": date(2023, 8, 8),
        "manager_name": "Андрей Уткин",
        "target_yield": "10-15% (net)",
        "horizon": "От двух лет",
        "risk_score": 5,
        "liquidity_label": "Ежемесячная",
        "interval_label": "Последние пять рабочих дней каждого месяца",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "1 млн ₽",
        "logistics": "₽ в ГПБ",
        "strategy_goal": (
            "Высокая абсолютная долларовая доходность на инвестиционном горизонте от двух лет. "
            "Фонд не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Управление дюрацией портфеля с целью увеличения доходности на различных стадиях рыночного цикла. "
            "Портфель из облигаций российских эмитентов в иностранной валюте, включая замещающие. "
            "Активное управление структурой портфеля; «короткие» позиции допускаются."
        ),
        "why_bullets": [
            "Активное управление — реакция на изменения ставок и макроусловий.",
            "«Короткие» позиции для дохода, хеджирования валютного и рыночного риска.",
            "Облигации в иностранной валюте — диверсификация валютных рисков.",
            "Институциональные условия фондирования.",
        ],
        "mgmt_fee_tiers": flat_tier(1.5, 20.0),
        **NO_DISCOUNT,
        "extra_expenses": "Спецдеп / Регистратор / Оценщик — не более 0,2%.",
        "hwm": True,
        "risks": [
            {"name": "Рыночный (процентный) риск", "severity": "Высокий", "description": "Изменение цен облигаций; высокая дюрация и заёмные средства."},
            {"name": "Риск инфраструктуры", "severity": "Средний", "description": "Санкции на биржевую инфраструктуру."},
            {"name": "Валютный риск", "severity": "Средний", "description": "Фонд номинирован в RUB; задержки конвертации."},
        ],
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Облигации", "issue": "ОФЗ 33 CNY", "coupon": "7,00%", "maturity": "2033"},
            {"instrument": "Облигации", "issue": "РЖД 1Р-51R", "coupon": "7,60%", "maturity": "2029"},
            {"instrument": "Облигации", "issue": "РФ ЗО 47 Д", "coupon": "5,25%", "maturity": "2047"},
            {"instrument": "Облигации", "issue": "РФ ЗО 35 Д", "coupon": "5,10%", "maturity": "2035"},
            {"instrument": "Облигации", "issue": "РФ ЗО 43 Д", "coupon": "5,88%", "maturity": "2043"},
        ],
        "fund_rules_no": "№ 5493-СД от 14.07.2023",
        "sort_order": 120,
    },
    {
        "key": "Aplus",
        "name": "Хедж-фонд А+",
        "short_name": "Хедж-фонд А+",
        "category": "alternative",
        "contract_type": "ИПИФ",
        "native_currency": "RUB",
        "benchmark": "MCFTR",
        "benchmark_label": "MCFTR",
        "isin": "RU000A108KP4",
        "inception_date": date(2024, 5, 21),
        "manager_name": "Николай Василенко",
        "target_yield": "30-40% (net)",
        "horizon": "От трёх лет",
        "risk_score": 5,
        "liquidity_label": "Ежемесячная",
        "interval_label": "Последние пять рабочих дней каждого месяца",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "1 млн ₽",
        "logistics": "₽ в ГПБ",
        "strategy_goal": (
            "Высокая абсолютная доходность в рублях на инвестиционном горизонте от трёх лет. "
            "Стратегия не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Фонд предусматривает инвестирование в акции публичных российских компаний, "
            "торгующихся на Московской бирже. Приоритет — частные компании с сильным "
            "корпоративным управлением, растущим бизнесом и катализаторами переоценки."
        ),
        "why_bullets": [
            "Анализ и отбор идей: нет идеи = нет позиции.",
            "Высокая концентрация в отдельных идеях (vs 10-15% у большинства ОПИФ).",
            "Возможность выйти в кэш и зарабатывать на денежном рынке.",
            "Заработок на падении и росте (от 100% «плеча» до 100% «шорта»).",
            "Участие в арбитражах, IPO/SPO, выкупы с дисконтами.",
        ],
        "mgmt_fee_tiers": flat_tier(1.5, 20.0),
        **NO_DISCOUNT,
        "extra_expenses": "Спецдеп / Регистратор / Оценщик — не более 0,2%. Надбавки и скидки отсутствуют.",
        "hwm": True,
        "risks": [
            {"name": "Рыночный риск", "severity": "Высокий", "description": "Изменение стоимости ценных бумаг."},
            {"name": "Риск ликвидности", "severity": "Средний", "description": "Низкая ликвидность рынка или остановка торгов."},
            {"name": "Кредитный риск", "severity": "Низкий", "description": "Банкротство эмитента."},
            {"name": "Инфраструктурный риск", "severity": "Низкий", "description": "Сбои биржевой инфраструктуры."},
        ],
        "top_positions_as_of": date(2026, 4, 30),
        "top_positions": [
            {"instrument": "Акции", "issuer": "ДОМ.РФ", "weight": "60,26%"},
            {"instrument": "Акции", "issuer": "Озон", "weight": "14,18%"},
            {"instrument": "Акции", "issuer": "МКПАО ЮМГ", "weight": "10,44%"},
            {"instrument": "Акции", "issuer": "Русагро", "weight": "5,92%"},
            {"instrument": "Акции", "issuer": "ЯНДЕКС", "weight": "4,59%"},
        ],
        "fund_rules_no": "№ 6157-СД от 02.05.2024",
        "sort_order": 130,
    },
    {
        "key": "M3",
        "name": "Хедж-фонд М3",
        "short_name": "Хедж-фонд М3",
        "category": "alternative",
        "contract_type": "ИПИФ",
        "native_currency": "GLD",
        "benchmark": "GLDRUB",
        "benchmark_label": "GLDRUB",
        "inception_date": date(2026, 1, 19),
        "manager_name": "Дмитрий Гаврилин",
        "target_yield": "5-15% годовых над GLDRUB",
        "horizon": "От двух лет",
        "risk_score": 5,
        "liquidity_label": "Ежемесячная",
        "interval_label": "Последние пять рабочих дней каждого месяца",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Квал",
        "min_check": "1 млн ₽",
        "logistics": "₽ в ГПБ",
        "strategy_goal": (
            "Абсолютная доходность в золоте на инвестиционном горизонте от двух лет. "
            "Фонд не подходит для краткосрочных инвестиций."
        ),
        "description": (
            "Активное управление структурой портфеля. «Ядро» — биржевое золото, «надстройка» — "
            "активные торговые операции на рынке рублёвых и валютных облигаций. Управляющий "
            "регулярно пересматривает структуру и ищет рыночные неэффективности."
        ),
        "why_bullets": [
            "Первый Хедж-фонд на золото в России.",
            "Защита через золото — ядро в длинной позиции GLDRUB.",
            "Доход поверх золотого «ядра» через надстройки из облигаций.",
            "Активное управление — широкий мандат.",
            "Выгодные условия для первых инвесторов — Success fee отменён в первом квартале существования фонда.",
        ],
        "mgmt_fee_tiers": flat_tier(1.5, 20.0, hurdle="GLDRUB"),
        **HF_DISCOUNT,
        "extra_expenses": "Спецдеп / Регистратор / Оценщик — не более 0,2%.",
        "hwm": True,
        "risks": [
            {"name": "Риск цены золота", "severity": "Высокий", "description": "Снижение мировых котировок золота и/или укрепление рубля."},
            {"name": "Рыночный риск облигаций", "severity": "Высокий", "description": "Изменение ставок и кредитных спредов; обеспечение под РЕПО."},
            {"name": "Риск заёмных средств и фондирования", "severity": "Высокий", "description": "Margin call при неблагоприятной динамике."},
            {"name": "Валютный риск", "severity": "Средний", "description": "Конвертация и оценка в RUB."},
            {"name": "Риск ликвидности", "severity": "Средний", "description": "Снижение ликвидности рынков золота/облигаций."},
            {"name": "Риск производных инструментов", "severity": "Средний", "description": "Базис, ролл, вариационная маржа."},
            {"name": "Риск инфраструктуры", "severity": "Средний", "description": "Ограничения биржевой инфраструктуры."},
        ],
        "fund_rules_no": "№ 7514-СД от 19.01.2026",
        "sort_order": 140,
    },
    # ──────────────── LIQUIDITY ────────────────
    {
        "key": "Liq",
        "name": "Мгновенная ликвидность",
        "short_name": "Мгновенная ликвидность",
        "category": "liquidity",
        "contract_type": "ДУ",
        "native_currency": "RUB",
        "benchmark": "RUSFAR",
        "benchmark_label": "RUSFAR",
        "manager_name": "Дмитрий Гаврилин",
        "target_yield": "14-15%",
        "horizon": "От 1 недели",
        "risk_score": 1,
        "liquidity_label": "Высокая",
        "investor_type_fl": "Квал",
        "investor_type_ul": "Неквал",
        "min_check": "25 млн ₽",
        "logistics": "₽ в НРД",
        "strategy_goal": (
            "Высокая абсолютная доходность в рублях при максимально возможной ликвидности."
        ),
        "description": (
            "Управляющий размещает средства инвестора на рынке РЕПО на короткие сроки (1-7 дней), "
            "выбирая наиболее привлекательную ставку, и регулярно продлевает сделки. "
            "Ставки денежного рынка привязаны к ключевой ставке ЦБ РФ."
        ),
        "why_bullets": [
            "Размещение на Московской бирже под залог высоконадёжных облигаций.",
            "Срок размещения средств — от 1-го рабочего дня.",
        ],
        "mgmt_fee_tiers": flat_tier(0.25, None),
        **NO_DISCOUNT,
        "extra_expenses": None,
        "hwm": False,
        "risks": [
            {"name": "Инфраструктурный риск", "severity": "Минимальный", "description": "Банкротство Московской биржи."},
        ],
        "sort_order": 150,
    },
]


async def upsert_funds(session: AsyncSession) -> tuple[int, int]:
    inserted = 0
    updated = 0
    for row in CATALOG:
        existing = await session.scalar(select(Fund).where(Fund.key == row["key"]))
        if existing is None:
            session.add(Fund(**row))
            inserted += 1
        else:
            for k, v in row.items():
                if k == "key":
                    continue
                setattr(existing, k, v)
            updated += 1
    await session.commit()
    return inserted, updated


async def main() -> None:
    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        ins, upd = await upsert_funds(s)
    await engine.dispose()
    print(f"seed_catalog: inserted={ins} updated={upd}")


if __name__ == "__main__":
    asyncio.run(main())
