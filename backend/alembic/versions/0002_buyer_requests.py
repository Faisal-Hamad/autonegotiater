"""one buyer, many sellers: buyer_requests, session.request_id, offer.utility_score

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "buyer_requests",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("buyer_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("max_budget", sa.Numeric(10, 2), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("preferences", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('active', 'awaiting_approval', 'completed', 'failed', 'cancelled')", name="status_valid"
        ),
        sa.CheckConstraint("mode IN ('automated', 'semi_automated')", name="mode_valid"),
    )
    op.create_index("ix_buyer_requests_buyer_id", "buyer_requests", ["buyer_id"])

    op.add_column(
        "negotiation_sessions",
        sa.Column("request_id", sa.BigInteger(), sa.ForeignKey("buyer_requests.id", ondelete="CASCADE")),
    )
    op.create_index("ix_negotiation_sessions_request_id", "negotiation_sessions", ["request_id"])

    op.add_column("offers", sa.Column("utility_score", sa.Numeric(5, 4)))


def downgrade() -> None:
    op.drop_column("offers", "utility_score")
    op.drop_index("ix_negotiation_sessions_request_id", table_name="negotiation_sessions")
    op.drop_column("negotiation_sessions", "request_id")
    op.drop_index("ix_buyer_requests_buyer_id", table_name="buyer_requests")
    op.drop_table("buyer_requests")
