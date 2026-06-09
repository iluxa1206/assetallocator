"""extend funds with catalog metadata

Revision ID: a1b2c3d4e5f6
Revises: 55f4a8b31da7
Create Date: 2026-05-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "55f4a8b31da7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_COLS = [
    ("short_name", sa.String()),
    ("category", sa.String()),
    ("contract_type", sa.String()),
    ("isin", sa.String()),
    ("ticker", sa.String()),
    ("inception_date", sa.Date()),
    ("fund_rules_no", sa.String()),
    ("aum", sa.Float()),
    ("aum_currency", sa.String()),
    ("manager_name", sa.String()),
    ("manager_bio", sa.Text()),
    ("target_yield", sa.String()),
    ("horizon", sa.String()),
    ("risk_score", sa.Integer()),
    ("liquidity_label", sa.String()),
    ("interval_label", sa.String()),
    ("investor_type_fl", sa.String()),
    ("investor_type_ul", sa.String()),
    ("min_check", sa.String()),
    ("logistics", sa.String()),
    ("strategy_goal", sa.Text()),
    ("description", sa.Text()),
    ("extra_expenses", sa.String()),
    ("redemption_discount_y1", sa.Float()),
    ("redemption_discount_y2", sa.Float()),
    ("top_positions_as_of", sa.Date()),
    ("color", sa.String()),
]

JSONB_COLS = [
    "why_bullets",
    "mgmt_fee_tiers",
    "risks",
    "top_positions",
    "documents",
]


def upgrade() -> None:
    for name, col_type in NEW_COLS:
        op.add_column("funds", sa.Column(name, col_type, nullable=True))
    for name in JSONB_COLS:
        op.add_column("funds", sa.Column(name, postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("funds", sa.Column("is_advisory", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("funds", sa.Column("hwm", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("funds", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("funds", "sort_order")
    op.drop_column("funds", "hwm")
    op.drop_column("funds", "is_advisory")
    for name in JSONB_COLS:
        op.drop_column("funds", name)
    for name, _ in NEW_COLS:
        op.drop_column("funds", name)
