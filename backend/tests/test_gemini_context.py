"""The language model gets public conversation context only (TC-AI)."""
from decimal import Decimal

from app.negotiation.gemini_service import GeminiService
from app.negotiation.seller_agent import SellerAgent, SellerContext
from app.negotiation.schemas import Decision


class _Recorder:
    def __init__(self):
        self.calls = []

    def generate_response(self, **kwargs):
        self.calls.append(kwargs)
        return "ok"


def test_context_has_no_numbers_from_limits():
    text = GeminiService._context_text({"role": "buyer", "product": "Office Chair", "round": 6, "max_rounds": 6,
                                        "competing_quote": True})
    assert "buyer's negotiation agent" in text and "final round" in text and "another seller" in text
    seller_text = GeminiService._context_text({"role": "seller", "competing_quote": True})
    assert "Never mention other buyers" in seller_text
    assert not any(ch.isdigit() for ch in text)


def test_no_context_keeps_old_prompt():
    assert GeminiService._context_text(None) == ""


def test_agent_adds_its_role_and_never_its_floor():
    language = _Recorder()
    agent = SellerAgent(SellerContext(asking_price=Decimal("4200"), minimum_price=Decimal("3900"), concession=Decimal("60")), language=language)
    agent.respond(Decision("counter", Decimal("4100"), "x"), "fallback", {"product": "Phone", "round": 2, "max_rounds": 6})
    call = language.calls[0]
    assert call["context"]["role"] == "seller"
    assert "3900" not in str(call)
