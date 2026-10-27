"""Seller-side adapter around the shared deterministic negotiation policy."""

from dataclasses import dataclass, field
from decimal import Decimal

from app.negotiation.engine import seller_decision
from app.negotiation.gemini_service import GeminiService, get_gemini_service
from app.negotiation.schemas import Decision, SellerDecisionInput


@dataclass(frozen=True)
class SellerContext:
    """Only one seller listing's private pricing rules."""

    asking_price: Decimal
    minimum_price: Decimal
    concession: Decimal | None = None
    target_price: Decimal | None = None
    auto_accept_threshold: Decimal | None = None
    accept_at_threshold: bool = True


@dataclass(frozen=True)
class SellerAgent:
    context: SellerContext
    language: GeminiService = field(default_factory=get_gemini_service, repr=False, compare=False)

    def decide(
        self,
        *,
        current_buyer_offer: Decimal,
        round_number: int,
        max_rounds: int,
        previous_seller_price: Decimal | None = None,
        competing_price: Decimal | None = None,
    ) -> Decision:
        return seller_decision(SellerDecisionInput(
            asking_price=self.context.asking_price,
            minimum_price=self.context.minimum_price,
            concession=self.context.concession,
            target_price=self.context.target_price,
            auto_accept_threshold=self.context.auto_accept_threshold,
            accept_at_threshold=self.context.accept_at_threshold,
            current_buyer_offer=current_buyer_offer,
            round_number=round_number,
            max_rounds=max_rounds,
            previous_seller_price=previous_seller_price,
            competing_price=competing_price,
        ))

    def respond(self, decision: Decision, fallback: str) -> str:
        """Phrase an approved decision without sharing private seller context."""
        if decision.price is None:
            return fallback
        return self.language.generate_response(
            action=decision.action, price=decision.price, fallback=fallback,
        )

    def parse_intent(self, text: str) -> dict | None:
        return self.language.parse_intent(text)
