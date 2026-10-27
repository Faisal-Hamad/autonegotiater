"""Typed inputs and outputs for private, deterministic agent decisions."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal


@dataclass(frozen=True)
class BuyerDecisionInput:
    target_price: Decimal
    maximum_price: Decimal
    round_number: int
    max_rounds: int
    current_seller_price: Decimal | None = None
    opening_price: Decimal | None = None
    previous_buyer_offer: Decimal | None = None
    acceptance_price: Decimal | None = None


@dataclass(frozen=True)
class SellerDecisionInput:
    asking_price: Decimal
    minimum_price: Decimal
    concession: Decimal | None
    round_number: int
    max_rounds: int
    current_buyer_offer: Decimal
    previous_seller_price: Decimal | None = None
    competing_price: Decimal | None = None
    target_price: Decimal | None = None
    auto_accept_threshold: Decimal | None = None
    accept_at_threshold: bool = True


@dataclass(frozen=True)
class Decision:
    action: Literal["offer", "counter", "accept", "reject"]
    price: Decimal | None
    reason: str
