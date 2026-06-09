"""re-add funds.aum/aum_currency/aum_as_of; add strategies.inception_date

`aum`/`aum_currency` were dropped in d4e5f6a7b8c9 as null-for-every-row. They're
brought back now (manager will fill them) together with `aum_as_of` (reporting date).
`strategies.inception_date` lets the catalog backtest the strategy from its launch.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("funds", sa.Column("aum", sa.Float(), nullable=True))
    op.add_column("funds", sa.Column("aum_currency", sa.String(), nullable=True))
    op.add_column("funds", sa.Column("aum_as_of", sa.Date(), nullable=True))
    op.add_column("strategies", sa.Column("inception_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("strategies", "inception_date")
    op.drop_column("funds", "aum_as_of")
    op.drop_column("funds", "aum_currency")
    op.drop_column("funds", "aum")
