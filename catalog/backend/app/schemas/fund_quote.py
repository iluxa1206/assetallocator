"""Pydantic schemas for FundQuote (NAV-series) admin endpoints."""

from __future__ import annotations

from datetime import date as date_

from pydantic import BaseModel, ConfigDict


class FundQuoteIn(BaseModel):
    date: date_
    price_rub: float
    price_native: float | None = None


class FundQuoteOut(FundQuoteIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class BulkUploadResult(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: list[str] = []
