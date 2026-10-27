"""Tests for the private-context BuyerAgent and SellerAgent adapters."""

import unittest
from dataclasses import fields
from decimal import Decimal

from app.negotiation.buyer_agent import BuyerAgent, BuyerContext
from app.negotiation.seller_agent import SellerAgent, SellerContext


class NegotiationAgentTests(unittest.TestCase):
    def test_buyer_agent_uses_buyer_context_and_shared_decision_policy(self):
        agent = BuyerAgent(BuyerContext(
            target_price=Decimal("900"),
            maximum_price=Decimal("900"),
            opening_price=Decimal("550"),
        ))
        decision = agent.decide(round_number=2, max_rounds=4)
        self.assertEqual((decision.action, decision.price), ("offer", Decimal("666.66")))
        self.assertNotIn("minimum_price", {field.name for field in fields(agent.context)})

    def test_seller_agent_uses_seller_context_and_shared_decision_policy(self):
        agent = SellerAgent(SellerContext(
            asking_price=Decimal("1000"),
            minimum_price=Decimal("600"),
            target_price=Decimal("600"),
        ))
        decision = agent.decide(current_buyer_offer=Decimal("500"), round_number=2, max_rounds=4)
        self.assertEqual((decision.action, decision.price), ("counter", Decimal("866.67")))
        self.assertNotIn("maximum_price", {field.name for field in fields(agent.context)})

    def test_seller_agent_can_accept_at_its_threshold(self):
        agent = SellerAgent(SellerContext(
            asking_price=Decimal("1000"),
            minimum_price=Decimal("600"),
            target_price=Decimal("600"),
            auto_accept_threshold=Decimal("850"),
        ))
        decision = agent.decide(current_buyer_offer=Decimal("850"), round_number=1, max_rounds=4)
        self.assertEqual((decision.action, decision.price), ("accept", Decimal("850.00")))


if __name__ == "__main__":
    unittest.main()
