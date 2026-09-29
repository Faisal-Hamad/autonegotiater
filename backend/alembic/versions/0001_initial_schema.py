"""initial schema from Phase 1 ERD (tables 4.1–4.8)

Revision ID: 0001
Revises:
Create Date: 2026-09-29
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _id() -> sa.Column:
    return sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True)


def _now(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=nullable)


def upgrade() -> None:
    op.create_table(
        "users",
        _id(),
        sa.Column("first_name", sa.String(50), nullable=False),
        sa.Column("last_name", sa.String(50), nullable=False),
        sa.Column("email", sa.String(100), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20)),
        sa.Column("role", sa.String(10), nullable=False),
        _now("registered_at"),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.CheckConstraint("role IN ('buyer', 'seller', 'admin')", name="role_valid"),
    )

    op.create_table(
        "products",
        _id(),
        sa.Column("seller_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("base_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("min_acceptable_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("stock_quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("image_url", sa.String(255)),
        _now("created_at"),
        sa.CheckConstraint("min_acceptable_price <= base_price", name="min_le_base"),
        sa.CheckConstraint("stock_quantity >= 0", name="stock_non_negative"),
    )
    op.create_index("ix_products_seller_id", "products", ["seller_id"])
    op.create_index("ix_products_category", "products", ["category"])

    op.create_table(
        "seller_rules",
        _id(),
        sa.Column("seller_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.BigInteger(), sa.ForeignKey("products.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("min_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("max_discount", sa.Numeric(5, 2), nullable=False),
        sa.Column("max_rounds", sa.Integer(), nullable=False),
        sa.Column("auto_accept_threshold", sa.Numeric(10, 2)),
    )

    op.create_table(
        "negotiation_sessions",
        _id(),
        sa.Column("buyer_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.BigInteger(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(15), server_default="active", nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("max_budget", sa.Numeric(10, 2), nullable=False),
        _now("started_at"),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("round_count", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint("status IN ('active', 'completed', 'failed', 'cancelled')", name="status_valid"),
        sa.CheckConstraint("mode IN ('automated', 'semi_automated')", name="mode_valid"),
    )
    op.create_index("ix_negotiation_sessions_buyer_id", "negotiation_sessions", ["buyer_id"])
    op.create_index("ix_negotiation_sessions_product_id", "negotiation_sessions", ["product_id"])

    op.create_table(
        "offers",
        _id(),
        sa.Column("session_id", sa.BigInteger(), sa.ForeignKey("negotiation_sessions.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("offered_by", sa.String(10), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("conditions", postgresql.JSONB(), server_default="{}", nullable=False),
        _now("created_at"),
        sa.Column("status", sa.String(15), server_default="pending", nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.CheckConstraint("offered_by IN ('buyer', 'seller', 'system')", name="offered_by_valid"),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'rejected', 'countered')", name="status_valid"),
    )
    op.create_index("ix_offers_session_id", "offers", ["session_id"])

    op.create_table(
        "deals",
        _id(),
        sa.Column("session_id", sa.BigInteger(), sa.ForeignKey("negotiation_sessions.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("final_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("final_conditions", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("closed_by", sa.String(10), nullable=False),
        _now("closed_at"),
        sa.Column("payment_status", sa.String(15), server_default="pending", nullable=False),
        sa.CheckConstraint("closed_by IN ('buyer', 'system')", name="closed_by_valid"),
        sa.CheckConstraint("payment_status IN ('pending', 'completed', 'cancelled')", name="payment_status_valid"),
    )

    op.create_table(
        "ratings",
        _id(),
        sa.Column("deal_id", sa.BigInteger(), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rater_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rated_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.String(500)),
        _now("created_at"),
        sa.CheckConstraint("score BETWEEN 1 AND 5", name="score_range"),
    )

    op.create_table(
        "audit_logs",
        _id(),
        sa.Column("session_id", sa.BigInteger(), sa.ForeignKey("negotiation_sessions.id", ondelete="SET NULL")),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(80), nullable=False),
        _now("created_at"),
        sa.Column("details", postgresql.JSONB(), server_default="{}", nullable=False),
    )
    op.create_index("ix_audit_logs_session_id", "audit_logs", ["session_id"])


def downgrade() -> None:
    for table in ("audit_logs", "ratings", "deals", "offers", "negotiation_sessions",
                  "seller_rules", "products", "users"):
        op.drop_table(table)
