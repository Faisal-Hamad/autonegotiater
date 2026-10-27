"""Gemini language service tests; all provider calls are mocked."""

import json
import os
import unittest
from decimal import Decimal
from unittest.mock import patch

from app.negotiation.buyer_agent import BuyerAgent, BuyerContext
from app.negotiation.gemini_service import GeminiService
from app.negotiation.schemas import Decision
from app.negotiation.seller_agent import SellerAgent, SellerContext


class FakeGeminiService(GeminiService):
    def __init__(self, keys=None, responses=()):
        super().__init__(keys=keys, failure_cooldown=60)
        self.responses = list(responses)
        self.calls = []
        self.timeouts = []

    def _call_gemini(self, key, prompt, response_schema, timeout):
        self.calls.append((key, prompt))
        self.timeouts.append(timeout)
        outcome = self.responses.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def response(message, price="3600.00"):
    return json.dumps({"message": message, "price": price})


class GeminiServiceTests(unittest.TestCase):
    def test_timeout_defaults_to_eight_seconds(self):
        with patch.dict(os.environ, {}, clear=True):
            service = GeminiService(keys=[])
        self.assertEqual(service._timeout, 8.0)

    def test_timeout_loads_configured_backend_environment_value(self):
        with patch.dict(os.environ, {"GEMINI_TIMEOUT_SECONDS": "12.5"}, clear=True):
            service = GeminiService(keys=[])
        self.assertEqual(service._timeout, 12.5)

    def test_invalid_timeout_values_fall_back_to_eight_seconds(self):
        for value in ("invalid", "0", "-1", "nan", "inf"):
            with self.subTest(value=value), patch.dict(
                os.environ, {"GEMINI_TIMEOUT_SECONDS": value}, clear=True
            ):
                service = GeminiService(keys=[])
            self.assertEqual(service._timeout, 8.0)

    def test_each_rotated_key_gets_configured_timeout(self):
        with patch.dict(os.environ, {"GEMINI_TIMEOUT_SECONDS": "8"}, clear=True):
            service = FakeGeminiService(
                keys=["first", "second"],
                responses=[TimeoutError(), response("Offer 3,600.00 SAR.")],
            )
        result = service.generate_response(
            action="offer", price=Decimal("3600"), fallback="Fallback"
        )
        self.assertEqual(result, "Offer 3,600.00 SAR.")
        self.assertEqual(service.timeouts, [8.0, 8.0])

    def test_timeout_uses_exact_deterministic_fallback(self):
        service = FakeGeminiService(keys=["one"], responses=[TimeoutError()])
        fallback = "Deterministic timeout fallback"
        self.assertEqual(service.generate_response(
            action="counter", price=Decimal("3600"), fallback=fallback
        ), fallback)
        self.assertEqual(service.last_fallback_reason, "request_timeout")

    def test_no_key_uses_fallback(self):
        service = GeminiService(keys=[])
        self.assertEqual(service.configured_key_count, 0)
        self.assertEqual(service.generate_response(
            action="offer", price=Decimal("3600"), fallback="Deterministic reply"
        ), "Deterministic reply")
        self.assertEqual(service.last_fallback_reason, "no_api_key_configured")

    def test_one_key_is_loaded_from_backend_environment(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": " only-key ", "GEMINI_API_KEYS": ""}, clear=False):
            service = FakeGeminiService(responses=[response("I can offer 3,600.00 SAR.")])
        self.assertEqual(service.configured_key_count, 1)
        self.assertEqual(service.generate_response(
            action="offer", price=Decimal("3600"), fallback="Fallback"
        ), "I can offer 3,600.00 SAR.")
        self.assertEqual(service.calls[0][0], "only-key")

    def test_multiple_keys_parse_and_rotate(self):
        with patch.dict(os.environ, {"GEMINI_API_KEYS": "key-a,key-b,key-c", "GEMINI_API_KEY": "key-a"}, clear=False):
            service = FakeGeminiService(responses=[
                response("Offer 3,600.00 SAR."), response("Counter 3,600.00 SAR."),
            ])
        self.assertEqual(service.configured_key_count, 3)
        for _ in range(2):
            service.generate_response(action="offer", price=Decimal("3600"), fallback="Fallback")
        self.assertEqual([key for key, _ in service.calls], ["key-a", "key-b"])

    def test_failed_first_key_falls_through_to_next(self):
        service = FakeGeminiService(
            keys=["first-secret", "second-secret"],
            responses=[TimeoutError("private transport details"), response("Offer 3,600.00 SAR.")],
        )
        result = service.generate_response(action="offer", price=Decimal("3600"), fallback="Fallback")
        self.assertEqual(result, "Offer 3,600.00 SAR.")
        self.assertEqual([key for key, _ in service.calls], ["first-secret", "second-secret"])

    def test_malformed_response_uses_fallback(self):
        service = FakeGeminiService(keys=["test"], responses=["not json"])
        self.assertEqual(service.generate_response(
            action="counter", price=Decimal("3600"), fallback="Fallback"
        ), "Fallback")
        self.assertEqual(service.last_fallback_reason, "invalid_json_response")

    def test_malformed_first_key_is_skipped_for_next_key(self):
        service = FakeGeminiService(
            keys=["first", "second"],
            responses=["not json", response("Counter 3,600.00 SAR.")],
        )
        self.assertEqual(service.generate_response(
            action="counter", price=Decimal("3600"), fallback="Fallback"
        ), "Counter 3,600.00 SAR.")
        self.assertEqual([key for key, _ in service.calls], ["first", "second"])

    def test_timeout_and_all_key_failures_use_fallback(self):
        service = FakeGeminiService(keys=["one", "two"], responses=[TimeoutError(), OSError()])
        self.assertEqual(service.generate_response(
            action="counter", price=Decimal("3600"), fallback="Fallback"
        ), "Fallback")
        self.assertEqual(len(service.calls), 2)

    def test_buyer_prompt_excludes_seller_private_floor(self):
        service = FakeGeminiService(keys=["test"], responses=[response("Offer 3,600.00 SAR.")])
        agent = BuyerAgent(BuyerContext(
            target_price=Decimal("7000"), maximum_price=Decimal("9000"),
        ), language=service)
        agent.respond(Decision("offer", Decimal("3600"), "approved"), "Fallback")
        prompt = service.calls[0][1]
        self.assertNotIn("123.45", prompt)
        self.assertNotIn("minimum", prompt.lower())

    def test_seller_prompt_excludes_buyer_private_maximum(self):
        service = FakeGeminiService(keys=["test"], responses=[response("Counter 3,600.00 SAR.")])
        agent = SellerAgent(SellerContext(
            asking_price=Decimal("5000"), minimum_price=Decimal("123.45"),
        ), language=service)
        agent.respond(Decision("counter", Decimal("3600"), "approved"), "Fallback")
        prompt = service.calls[0][1]
        self.assertNotIn("9876.54", prompt)
        self.assertNotIn("budget", prompt.lower())

    def test_gemini_cannot_change_approved_engine_price(self):
        service = FakeGeminiService(keys=["test"], responses=[response("I offer 3,500.00 SAR.", "3500.00")])
        self.assertEqual(service.generate_response(
            action="offer", price=Decimal("3600"), fallback="Approved fallback at 3600"
        ), "Approved fallback at 3600")
        self.assertEqual(service.last_fallback_reason, "returned_price_mismatch")

    def test_response_can_omit_digits_when_structured_price_is_approved(self):
        service = FakeGeminiService(keys=["test"], responses=[response("I can make that offer.")])
        self.assertEqual(service.generate_response(
            action="offer", price=Decimal("3600"), fallback="Fallback"
        ), "I can make that offer.")

    def test_invalid_candidate_does_not_quarantine_healthy_key(self):
        service = FakeGeminiService(
            keys=["test"],
            responses=[response("I offer 3,500.00 SAR."), response("I offer 3,600.00 SAR.")],
        )
        self.assertEqual(service.generate_response(
            action="offer", price=Decimal("3600"), fallback="Fallback"
        ), "Fallback")
        self.assertEqual(service.last_fallback_reason, "message_contains_unapproved_amount")
        self.assertEqual(service.generate_response(
            action="offer", price=Decimal("3600"), fallback="Fallback"
        ), "I offer 3,600.00 SAR.")
        self.assertEqual(len(service.calls), 2)

    def test_all_keys_failed_then_subsequent_call_falls_back_without_retry(self):
        service = FakeGeminiService(keys=["bad"], responses=[OSError()])
        self.assertEqual(service.generate_response(
            action="offer", price=Decimal("3600"), fallback="Fallback"
        ), "Fallback")
        self.assertEqual(service.generate_response(
            action="offer", price=Decimal("3600"), fallback="Fallback"
        ), "Fallback")
        self.assertEqual(len(service.calls), 1)

    def test_natural_text_parser_returns_validated_structured_intent(self):
        service = FakeGeminiService(keys=["test"], responses=[json.dumps({
            "intent": "offer", "price": 3400, "delivery": "pickup", "time": "today",
        })])
        parsed = service.parse_intent("I can pay 3400 for pickup today")
        self.assertEqual(parsed, {
            "intent": "offer", "price": Decimal("3400"), "delivery": "pickup", "time": "today",
        })


if __name__ == "__main__":
    unittest.main()
