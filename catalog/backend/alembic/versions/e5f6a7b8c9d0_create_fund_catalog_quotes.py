"""create fund_catalog_quotes (catalog-only NAV editable in admin UI)

Splits the backtest series (fund_quotes — read by dashboard portfolio engine) from
the editable catalog series (fund_catalog_quotes — used by /funds/series, /performance).

The migration also copies current fund_quotes → fund_catalog_quotes so that any
user edits already made via the admin UI are preserved as the initial catalog state.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-29 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fund_catalog_quotes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fund_key", sa.String(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("price_rub", sa.Float(), nullable=False),
        sa.Column("price_native", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["fund_key"], ["funds.key"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fund_key", "date"),
    )
    # Bootstrap the catalog table from whatever is currently in fund_quotes — keeps any
    # admin edits intact as the initial catalog state.
    op.execute(
        "INSERT INTO fund_catalog_quotes (fund_key, date, price_rub, price_native) "
        "SELECT fund_key, date, price_rub, price_native FROM fund_quotes"
    )


def downgrade() -> None:
    op.drop_table("fund_catalog_quotes")
