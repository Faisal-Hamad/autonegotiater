"""Characterization tests for the authenticated one-to-one workflow."""

import asyncio
import unittest
from decimal import Decimal
from types import SimpleNamespace

from app.models import AuditLog, Offer, Product, SellerRule
from app.routers.workspace import _run_agent_turn


class _Rows:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return list(self.rows)


class _Session:
    def __init__(self, *, asking="1000.00", floor="600.00", budget="900.00", rounds=4, threshold=None,
                 scenario="agreement", offers=None):
        self.product = SimpleNamespace(
            id=31,
            base_price=Decimal(asking),
            min_acceptable_price=Decimal(floor),
            stock_quantity=5,
        )
        self.rule = SimpleNamespace(
            min_price=Decimal(floor),
            max_discount=(Decimal(asking) - Decimal(floor)) / Decimal(asking) * Decimal("100"),
            max_rounds=rounds,
            auto_accept_threshold=Decimal(threshold) if threshold is not None else None,
        )
        self.negotiation = SimpleNamespace(
            id=41,
            buyer_id=51,
            product_id=31,
            status="active",
            mode="semi_automated",
            max_budget=Decimal(budget),
            round_count=0,
            request_id=None,
            ended_at=None,
        )
        self.offers = list(offers or [])
        self.audits = [SimpleNamespace(action="session_started", details={"scenario": scenario})]
        self.added = []

    async def get(self, model, _identity):
        return self.product if model is Product else None

    async def scalar(self, statement):
        if statement.column_descriptions[0]["entity"] is SellerRule:
            return self.rule
        return None

    async def scalars(self, statement):
        entity = statement.column_descriptions[0]["entity"]
        if entity is Offer:
            return _Rows(self.offers)
        if entity is AuditLog:
            if "audit_logs.action" in str(statement):
                return _Rows([a for a in self.audits if a.action == "rules_updated"])
            return _Rows(self.audits)
        return _Rows([])

    def add(self, value):
        self.added.append(value)
        if isinstance(value, Offer):
            self.offers.append(value)
        elif isinstance(value, AuditLog):
            self.audits.append(value)

    async def flush(self):
        return None


def turn(db):
    return asyncio.run(_run_agent_turn(db, db.negotiation))


def prices(db, offered_by):
    return [o.price for o in db.offers if o.offered_by == offered_by]


class OneToOneCharacterizationTests(unittest.TestCase):
    def test_buyer_opening_offer_is_55_percent_of_asking(self):
        db = _Session()
        self.assertEqual(turn(db), "turn")
        self.assertEqual(prices(db, "buyer"), [Decimal("550.00")])
        self.assertEqual(db.offers[-1].round_number, 1)
        self.assertEqual(db.offers[-1].conditions["action"], "offer")

    def test_buyer_concessions_progress_linearly_from_opening_to_budget(self):
        db = _Session(asking="1000", floor="900", budget="900", rounds=4)
        observed = []
        for _ in range(8):
            turn(db)
            if db.offers and db.offers[-1].offered_by == "buyer":
                observed.append(db.offers[-1].price)
        self.assertEqual(observed, [Decimal("550.00"), Decimal("666.66"), Decimal("783.33"), Decimal("900.00")])

    def test_buyer_never_exceeds_budget(self):
        db = _Session(asking="1000", floor="900", budget="700", rounds=4)
        for _ in range(8):
            turn(db)
        self.assertTrue(all(p <= Decimal("700.00") for p in prices(db, "buyer")))

    def test_seller_counters_never_fall_below_effective_floor(self):
        db = _Session(asking="1000", floor="600", budget="500", rounds=4)
        for _ in range(8):
            turn(db)
        self.assertTrue(all(p >= Decimal("600.00") for p in prices(db, "seller")))

    def test_seller_accepts_offer_at_auto_accept_threshold(self):
        buyer_offer = Offer(session_id=41, offered_by="buyer", price=Decimal("850"),
                            conditions={"action": "offer"}, status="pending", round_number=1)
        db = _Session(threshold="850", offers=[buyer_offer])
        self.assertEqual(turn(db), "agreed")
        self.assertEqual((db.offers[-1].offered_by, db.offers[-1].conditions["action"], db.offers[-1].price),
                         ("seller", "accept", Decimal("850")))
        self.assertEqual(db.offers[-1].status, "accepted")
        self.assertEqual(db.negotiation.status, "active")

    def test_buyer_accepts_seller_counter_within_target(self):
        seller_offer = Offer(session_id=41, offered_by="seller", price=Decimal("800"),
                             conditions={"action": "counteroffer"}, status="countered", round_number=1)
        db = _Session(offers=[seller_offer])
        self.assertEqual(turn(db), "agreed")
        self.assertEqual((db.offers[-1].offered_by, db.offers[-1].conditions["action"], db.offers[-1].price),
                         ("buyer", "accept", Decimal("800")))
        self.assertEqual(db.offers[-1].round_number, 1)
        self.assertEqual(db.offers[-1].status, "accepted")
        self.assertEqual(db.negotiation.status, "active")

    def test_seller_counter_schedule_and_max_round_failure(self):
        db = _Session(asking="1000", floor="600", budget="500", rounds=4)
        outcomes = []
        for _ in range(8):
            outcomes.append(turn(db))
            if db.negotiation.status != "active":
                break
        self.assertEqual(prices(db, "seller"), [Decimal("1000.00"), Decimal("866.67"), Decimal("733.34"), Decimal("600.00")])
        self.assertEqual(db.negotiation.status, "failed")
        self.assertEqual(db.negotiation.round_count, 4)
        self.assertEqual(outcomes[-1], "failed")

    def test_offer_actions_and_round_numbers_for_first_round(self):
        db = _Session()
        self.assertEqual(turn(db), "turn")
        self.assertEqual(turn(db), "turn")
        self.assertEqual([(o.offered_by, o.conditions["action"], o.round_number) for o in db.offers],
                         [("buyer", "offer", 1), ("seller", "counteroffer", 1)])
        self.assertEqual(db.negotiation.status, "active")

    def test_non_overlapping_limits_fail_without_agreement(self):
        db = _Session(asking="1000", floor="600", budget="500", rounds=4)
        for _ in range(10):
            if db.negotiation.status != "active":
                break
            turn(db)
        self.assertEqual(db.negotiation.status, "failed")
        self.assertFalse(any(o.status == "accepted" for o in db.offers))

    def test_completed_negotiation_can_be_advanced_without_more_offers(self):
        accepted = Offer(session_id=41, offered_by="seller", price=Decimal("800"),
                          conditions={"action": "accept"}, status="accepted", round_number=1)
        db = _Session(offers=[accepted])
        self.assertEqual(turn(db), "noop")
        self.assertEqual(len(db.offers), 1)


if __name__ == "__main__":
    unittest.main()
