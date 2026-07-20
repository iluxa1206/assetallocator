"""add peer-tracking columns to funds (competitors tab)

Adds `kind` (own/competitor/benchmark) plus data-provenance columns so competitor
funds can live in the same `funds` table and reuse the NAV series engine, while
staying out of the /catalog listing (which filters kind='own').

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("funds", sa.Column("kind", sa.String(), nullable=False, server_default="own"))
    op.add_column("funds", sa.Column("provider", sa.String(), nullable=True))
    op.add_column("funds", sa.Column("source", sa.String(), nullable=True))
    op.add_column("funds", sa.Column("source_ref", sa.String(), nullable=True))
    op.add_column("funds", sa.Column("source_board", sa.String(), nullable=True))
    op.add_column("funds", sa.Column("peer_group", sa.String(), nullable=True))
    op.add_column("funds", sa.Column("last_synced_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("funds", "last_synced_at")
    op.drop_column("funds", "peer_group")
    op.drop_column("funds", "source_board")
    op.drop_column("funds", "source_ref")
    op.drop_column("funds", "source")
    op.drop_column("funds", "provider")
    op.drop_column("funds", "kind")
