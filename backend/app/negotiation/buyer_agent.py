"""Buyer-side adapter around the shared deterministic negotiation policy."""

from dataclasses import dataclass, field
from decimal import Decimal

from app.negotiation.engine import buyer_decision
from app.negotiation.gemini_service import GeminiService, get_gemini_service
from app.negotiation.schemas import BuyerDecisionInput, Decision


@dataclass(frozen=True)
class BuyerContext:
    """Only buyer-authorized price limits and preferences."""

    target_price: Decimal
    maximum_price: Decimal
    opening_price: Decimal | None = None
    acceptance_price: Decimal | None = None


@dataclass(frozen=True)
class BuyerAgent:
    context: BuyerContext
    language: GeminiService = field(default_factory=get_gemini_service, repr=False, compare=False)

    def decide(
        self,
        *,
        round_number: int,
        max_rounds: int,
        current_seller_price: Decimal | None = None,
        previous_buyer_offer: Decimal | None = None,
    ) -> Decision:
        return buyer_decision(BuyerDecisionInput(
            target_price=self.context.target_price,
            maximum_price=self.context.maximum_price,
            opening_price=self.context.opening_price,
            acceptance_price=self.context.acceptance_price,
            round_number=round_number,
            max_rounds=max_rounds,
            current_seller_price=current_seller_price,
            previous_buyer_offer=previous_buyer_offer,
        ))

    def respond(self, decision: Decision, fallback: str) -> str:
        """Phrase an approved decision without sharing private buyer context."""
        if decision.price is None:
            return fallback
        return self.language.generate_response(
            action=decision.action, price=decision.price, fallback=fallback,
        )

    def parse_intent(self, text: str) -> dict | None:
        return self.language.parse_intent(text)
