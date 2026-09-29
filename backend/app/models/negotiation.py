from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, Integer, Numeric, SmallInteger, String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class NegotiationSession(Base):
    """ERD Table 4.4."""

    __tablename__ = "negotiation_sessions"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'completed', 'failed', 'cancelled')", name="status_valid"),
        CheckConstraint("mode IN ('automated', 'semi_automated')", name="mode_valid"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(15), server_default="active")
    mode: Mapped[str] = mapped_column(String(20))
    # Private to the buyer — never returned to the seller (NFR-03).
    max_budget: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    round_count: Mapped[int] = mapped_column(Integer, server_default="0")


class Offer(Base):
    """ERD Table 4.5."""

    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint("offered_by IN ('buyer', 'seller', 'system')", name="offered_by_valid"),
        CheckConstraint("status IN ('pending', 'accepted', 'rejected', 'countered')", name="status_valid"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("negotiation_sessions.id", ondelete="CASCADE"), index=True)
    offered_by: Mapped[str] = mapped_column(String(10))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    conditions: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(15), server_default="pending")
    round_number: Mapped[int] = mapped_column(Integer)


class Deal(Base):
    """ERD Table 4.6."""

    __tablename__ = "deals"
    __table_args__ = (
        CheckConstraint("closed_by IN ('buyer', 'system')", name="closed_by_valid"),
        CheckConstraint("payment_status IN ('pending', 'completed', 'cancelled')", name="payment_status_valid"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("negotiation_sessions.id", ondelete="CASCADE"), unique=True)
    final_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    final_conditions: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
    closed_by: Mapped[str] = mapped_column(String(10))
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    payment_status: Mapped[str] = mapped_column(String(15), server_default="pending")


class Rating(Base):
    """ERD Table 4.7."""

    __tablename__ = "ratings"
    __table_args__ = (CheckConstraint("score BETWEEN 1 AND 5", name="score_range"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    deal_id: Mapped[int] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"))
    rater_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rated_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    score: Mapped[int] = mapped_column(SmallInteger)
    comment: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    """ERD Table 4.8."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("negotiation_sessions.id", ondelete="SET NULL"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
