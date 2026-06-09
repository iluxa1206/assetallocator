"""create strategies table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-28 00:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "strategies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("risk_profile", sa.String(), nullable=False),
        sa.Column("ccy_strategy", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("composition", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("target_yield", sa.String(), nullable=True),
        sa.Column("target_vol", sa.String(), nullable=True),
        sa.Column("horizon", sa.String(), nullable=True),
        sa.Column("min_check", sa.String(), nullable=True),
        sa.Column("rebalance_period", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )


def downgrade() -> None:
    op.drop_table("strategies")
