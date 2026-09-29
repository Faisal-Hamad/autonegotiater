from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, Integer, Numeric, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Product(Base):
    """ERD Table 4.2."""

    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("min_acceptable_price <= base_price", name="min_le_base"),
        CheckConstraint("stock_quantity >= 0", name="stock_non_negative"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80), index=True)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # Private to the seller — never returned by public API schemas (NFR-03).
    min_acceptable_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    stock_quantity: Mapped[int] = mapped_column(Integer, server_default="1")
    image_url: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SellerRule(Base):
    """ERD Table 4.3."""

    __tablename__ = "seller_rules"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), unique=True)
    min_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    max_discount: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    max_rounds: Mapped[int] = mapped_column(Integer)
    auto_accept_threshold: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
