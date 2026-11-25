"""Project registry fields and outbox delivery backoff.

Revision ID: 0004
Revises: 0003
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("kind", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("visibility", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("is_private", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("repo_pushed_at", sa.DateTime(timezone=True), nullable=True))
    with op.batch_alter_table("event_outbox") as batch:
        batch.add_column(sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("event_outbox") as batch:
        batch.drop_column("next_attempt_at")
    with op.batch_alter_table("projects") as batch:
        batch.drop_column("repo_pushed_at")
        batch.drop_column("is_private")
        batch.drop_column("visibility")
        batch.drop_column("kind")
