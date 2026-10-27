"""Unit tests for shared decisions, independent of FastAPI and PostgreSQL."""

import unittest
from decimal import Decimal
from dataclasses import fields

from app.negotiation.engine import buyer_decision, seller_decision
from app.negotiation.schemas import BuyerDecisionInput, SellerDecisionInput


class SharedEngineTests(unittest.TestCase):
    def test_buyer_opening_and_gradual_concessions(self):
        offers = [
            buyer_decision(BuyerDecisionInput(
                target_price=Decimal("900"), maximum_price=Decimal("900"),
                opening_price=Decimal("550"), round_number=round_number, max_rounds=4,
            )).price
            for round_number in range(1, 5)
        ]
        self.assertEqual(offers, [Decimal("550.00"), Decimal("666.66"), Decimal("783.33"), Decimal("900.00")])

    def test_buyer_does_not_exceed_budget(self):
        decision = buyer_decision(BuyerDecisionInput(
            target_price=Decimal("700"), maximum_price=Decimal("700"),
            opening_price=Decimal("550"), round_number=12, max_rounds=12,
        ))
        self.assertLessEqual(decision.price, Decimal("700"))

    def test_buyer_accepts_counteroffer_within_its_limit(self):
        decision = buyer_decision(BuyerDecisionInput(
            target_price=Decimal("900"), maximum_price=Decimal("900"),
            current_seller_price=Decimal("800"), acceptance_price=Decimal("900"),
            round_number=2, max_rounds=4,
        ))
        self.assertEqual((decision.action, decision.price), ("accept", Decimal("800.00")))

    def test_seller_counter_schedule_respects_private_floor(self):
        counters = [
            seller_decision(SellerDecisionInput(
                asking_price=Decimal("1000"), minimum_price=Decimal("600"), concession=None,
                target_price=Decimal("600"), current_buyer_offer=Decimal("500"),
                round_number=round_number, max_rounds=4,
            )).price
            for round_number in range(1, 5)
        ]
        self.assertEqual(counters, [Decimal("1000.00"), Decimal("866.67"), Decimal("733.34"), Decimal("600.00")])
        self.assertTrue(all(price >= Decimal("600") for price in counters))

    def test_seller_accepts_offer_at_threshold(self):
        decision = seller_decision(SellerDecisionInput(
            asking_price=Decimal("1000"), minimum_price=Decimal("600"), concession=None,
            target_price=Decimal("600"), current_buyer_offer=Decimal("850"),
            auto_accept_threshold=Decimal("850"), round_number=1, max_rounds=4,
        ))
        self.assertEqual((decision.action, decision.price), ("accept", Decimal("850.00")))

    def test_seller_never_accepts_below_floor(self):
        decision = seller_decision(SellerDecisionInput(
            asking_price=Decimal("1000"), minimum_price=Decimal("600"), concession=None,
            target_price=Decimal("600"), current_buyer_offer=Decimal("599.99"),
            round_number=4, max_rounds=4,
        ))
        self.assertEqual(decision.action, "counter")
        self.assertGreaterEqual(decision.price, Decimal("600"))

    def test_final_budget_acceptance_and_round_limit(self):
        accepted = buyer_decision(BuyerDecisionInput(
            target_price=Decimal("900"), maximum_price=Decimal("900"),
            current_seller_price=Decimal("900"), round_number=4, max_rounds=4,
        ))
        self.assertEqual(accepted.action, "accept")
        self.assertEqual(accepted.price, Decimal("900.00"))
        with self.assertRaises(ValueError):
            buyer_decision(BuyerDecisionInput(
                target_price=Decimal("900"), maximum_price=Decimal("900"),
                round_number=0, max_rounds=4,
            ))

    def test_party_inputs_do_not_include_the_other_partys_private_limit(self):
        buyer_fields = {field.name for field in fields(BuyerDecisionInput)}
        seller_fields = {field.name for field in fields(SellerDecisionInput)}
        self.assertNotIn("minimum_price", buyer_fields)
        self.assertNotIn("seller_floor", buyer_fields)
        self.assertNotIn("maximum_price", seller_fields)
        self.assertNotIn("buyer_budget", seller_fields)


if __name__ == "__main__":
    unittest.main()
