"""drop speculative columns (aum, aum_currency, is_advisory on funds; target_vol on strategies)

`is_advisory` is fully derivable from `contract_type == 'Advisory'`.
`aum`/`aum_currency` are null for every seeded row and the source data does not provide them.
`target_vol` is null for every strategy.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("funds", "aum")
    op.drop_column("funds", "aum_currency")
    op.drop_column("funds", "is_advisory")
    op.drop_column("strategies", "target_vol")


def downgrade() -> None:
    op.add_column("funds", sa.Column("aum", sa.Float(), nullable=True))
    op.add_column("funds", sa.Column("aum_currency", sa.String(), nullable=True))
    op.add_column("funds", sa.Column("is_advisory", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("strategies", sa.Column("target_vol", sa.String(), nullable=True))
