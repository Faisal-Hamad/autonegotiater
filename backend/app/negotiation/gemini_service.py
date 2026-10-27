"""Backend-only Gemini language helpers with deterministic fallbacks."""

from __future__ import annotations

import json
import math
import os
import re
import threading
import time
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


_INTENTS = {"offer", "accept", "reject", "counter", "other"}
_AMOUNT = re.compile(r"(?<![\w.])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?![\w.])")
_DEFAULT_TIMEOUT_SECONDS = 8.0


class GeminiService:
    """Small REST client for language-only tasks; keys never leave the backend."""

    def __init__(
        self,
        keys: tuple[str, ...] | list[str] | None = None,
        *,
        model: str | None = None,
        timeout: float | None = None,
        failure_cooldown: float = 30.0,
    ) -> None:
        self._keys = self._load_keys() if keys is None else self._clean_keys(keys)
        self._model = model or os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
        self._timeout = self._load_timeout() if timeout is None else timeout
        self._failure_cooldown = failure_cooldown
        self._next_index = 0
        self._failed_until: dict[str, float] = {}
        self._lock = threading.Lock()
        self.last_fallback_reason: str | None = None

    @staticmethod
    def _load_timeout() -> float:
        raw = os.environ.get("GEMINI_TIMEOUT_SECONDS")
        if raw is None:
            return _DEFAULT_TIMEOUT_SECONDS
        try:
            timeout = float(raw)
        except (TypeError, ValueError):
            return _DEFAULT_TIMEOUT_SECONDS
        return timeout if math.isfinite(timeout) and timeout > 0 else _DEFAULT_TIMEOUT_SECONDS

    @staticmethod
    def _clean_keys(keys: tuple[str, ...] | list[str]) -> tuple[str, ...]:
        return tuple(dict.fromkeys(key.strip() for key in keys if key and key.strip()))

    @classmethod
    def _load_keys(cls) -> tuple[str, ...]:
        # Both variables are backend process environment settings. The plural
        # variable accepts comma or newline separated keys; the singular form
        # remains supported and is merged without duplicates.
        multiple = re.split(r"[,\n]", os.environ.get("GEMINI_API_KEYS", ""))
        single = [os.environ.get("GEMINI_API_KEY", "")]
        return cls._clean_keys(multiple + single)

    @property
    def configured_key_count(self) -> int:
        """Expose only a count for diagnostics; never expose key material."""
        return len(self._keys)

    def parse_intent(self, text: str) -> dict[str, Any] | None:
        """Parse natural language into a small validated intent object."""
        if not isinstance(text, str) or not text.strip():
            return None
        prompt = (
            "Extract the user's negotiation intent. Return JSON only with keys "
            '"intent" (offer, accept, reject, counter, or other), "price" '
            '(number or null), "delivery" (string or null), and "time" '
            "(string or null). Do not infer a price. User text:\n" + text[:4000]
        )
        schema = {
            "type": "OBJECT",
            "properties": {
                "intent": {"type": "STRING", "enum": sorted(_INTENTS)},
                "price": {"type": "NUMBER", "nullable": True},
                "delivery": {"type": "STRING", "nullable": True},
                "time": {"type": "STRING", "nullable": True},
            },
            "required": ["intent", "price", "delivery", "time"],
        }
        raw = self._generate(prompt, schema, validator=self._valid_intent)
        if raw is None:
            return None
        try:
            parsed = json.loads(raw)
            intent = parsed.get("intent")
            if intent not in _INTENTS:
                return None
            price = parsed.get("price")
            if price is not None:
                price = Decimal(str(price))
                if not price.is_finite() or price <= 0:
                    return None
            delivery = parsed.get("delivery")
            when = parsed.get("time")
            return {
                "intent": intent,
                "price": price,
                "delivery": delivery[:200] if isinstance(delivery, str) else None,
                "time": when[:200] if isinstance(when, str) else None,
            }
        except (ValueError, TypeError, InvalidOperation, AttributeError):
            return None

    def generate_response(self, *, action: str, price: Decimal, fallback: str) -> str:
        """Phrase an already-approved action and price; never return a new price."""
        self.last_fallback_reason = None
        if action not in {"offer", "counter", "counteroffer", "accept", "reject"}:
            self.last_fallback_reason = "unsupported_action"
            return fallback
        try:
            approved = Decimal(str(price)).quantize(Decimal("0.01"))
            if not approved.is_finite() or approved <= 0:
                self.last_fallback_reason = "invalid_approved_price"
                return fallback
        except (InvalidOperation, ValueError):
            self.last_fallback_reason = "invalid_approved_price"
            return fallback

        price_text = f"{approved:,.2f}"
        prompt = (
            "Write one concise, natural negotiation reply in English. You are only "
            "phrasing an approved action. Return JSON with exactly the fields "
            '"message" (string) and "price" (number). The price must exactly '
            f"equal {price_text}; do not change it or add any other amounts. "
            f"Approved action: {action}. Approved price: {price_text} SAR."
        )
        schema = {
            "type": "OBJECT",
            "properties": {"message": {"type": "STRING"}, "price": {"type": "NUMBER"}},
            "required": ["message", "price"],
        }
        raw = self._generate(
            prompt,
            schema,
            validator=lambda candidate: self._valid_response(candidate, approved),
            validation_reason=lambda candidate: self._response_validation_reason(candidate, approved),
        )
        if raw is None:
            return fallback
        return json.loads(raw)["message"].strip()[:500]

    @staticmethod
    def _valid_intent(raw: str) -> bool:
        try:
            parsed = json.loads(raw)
            if parsed.get("intent") not in _INTENTS:
                return False
            price = parsed.get("price")
            if price is not None:
                price = Decimal(str(price))
                if not price.is_finite() or price <= 0:
                    return False
            return all(parsed.get(key) is None or isinstance(parsed.get(key), str) for key in ("delivery", "time"))
        except (ValueError, TypeError, InvalidOperation, AttributeError):
            return False

    @staticmethod
    def _valid_response(raw: str, approved: Decimal) -> bool:
        try:
            parsed = json.loads(raw)
            response = parsed.get("message")
            returned_price = Decimal(str(parsed.get("price")))
            if not isinstance(response, str) or not response.strip() or returned_price != approved:
                return False
            # Reject text that introduces a different numeric amount.
            amounts = [Decimal(match.replace(",", "")) for match in _AMOUNT.findall(response)]
            # The structured numeric field is authoritative. The prose may omit
            # digits (for example, "I can offer the approved price"), but any
            # numeric amount it does include must match the approved price.
            return all(amount == approved for amount in amounts)
        except (ValueError, TypeError, InvalidOperation, AttributeError):
            return False

    @staticmethod
    def _response_validation_reason(raw: str, approved: Decimal) -> str:
        try:
            parsed = json.loads(raw)
        except (ValueError, TypeError):
            return "invalid_json_response"
        if not isinstance(parsed, dict):
            return "response_not_object"
        message = parsed.get("message")
        if not isinstance(message, str) or not message.strip():
            return "invalid_message_field"
        try:
            returned_price = Decimal(str(parsed.get("price")))
            if not returned_price.is_finite() or returned_price <= 0:
                return "invalid_returned_price"
        except (InvalidOperation, ValueError, TypeError, AttributeError):
            return "invalid_returned_price"
        if returned_price != approved:
            return "returned_price_mismatch"
        amounts = [Decimal(match.replace(",", "")) for match in _AMOUNT.findall(message)]
        if not amounts:
            return "message_omits_numeric_price"
        if any(amount != approved for amount in amounts):
            return "message_contains_unapproved_amount"
        return "response_validation_failed"

    def _generate(
        self,
        prompt: str,
        response_schema: dict[str, Any],
        *,
        validator=None,
        validation_reason=None,
    ) -> str | None:
        if not self._keys:
            self.last_fallback_reason = "no_api_key_configured"
            return None
        now = time.monotonic()
        with self._lock:
            available = [key for key in self._keys if self._failed_until.get(key, 0) <= now]
            if not available:
                self.last_fallback_reason = "all_keys_in_cooldown"
                return None
            start = self._next_index % len(self._keys)
            ordered = [self._keys[(start + offset) % len(self._keys)] for offset in range(len(self._keys))]
            ordered = [key for key in ordered if key in available]
            self._next_index = (self._next_index + 1) % len(self._keys)

        for key in ordered:
            try:
                result = self._call_gemini(key, prompt, response_schema, self._timeout)
                if isinstance(result, str) and result.strip():
                    result = result.strip()
                    if validator is None or validator(result):
                        self.last_fallback_reason = None
                        return result
                    self.last_fallback_reason = (
                        validation_reason(result)
                        if validation_reason is not None
                        else self._validation_reason(result, response_schema)
                    )
                else:
                    self.last_fallback_reason = "empty_provider_response"
            except HTTPError as exc:
                self.last_fallback_reason = f"http_error_{exc.code}"
                with self._lock:
                    self._failed_until[key] = time.monotonic() + self._failure_cooldown
            except TimeoutError:
                # Network timeout details can include request data, so retain only
                # a stable category for diagnostics.
                self.last_fallback_reason = "request_timeout"
                with self._lock:
                    self._failed_until[key] = time.monotonic() + self._failure_cooldown
            except URLError:
                self.last_fallback_reason = "transport_error"
                with self._lock:
                    self._failed_until[key] = time.monotonic() + self._failure_cooldown
            except OSError:
                self.last_fallback_reason = "transport_error"
                with self._lock:
                    self._failed_until[key] = time.monotonic() + self._failure_cooldown
            except Exception:
                # Avoid logging exceptions: HTTP errors and request objects can
                # contain credential-bearing URLs.
                self.last_fallback_reason = "provider_response_error"
                with self._lock:
                    self._failed_until[key] = time.monotonic() + self._failure_cooldown
        return None

    @staticmethod
    def _validation_reason(raw: str, response_schema: dict[str, Any]) -> str:
        """Return a credential-free reason for rejecting a candidate response."""
        try:
            parsed = json.loads(raw)
        except (ValueError, TypeError):
            return "invalid_json_response"
        properties = response_schema.get("properties", {})
        if "message" not in properties:
            return "response_validation_failed"
        message = parsed.get("message") if isinstance(parsed, dict) else None
        if not isinstance(message, str) or not message.strip():
            return "invalid_message_field"
        try:
            returned_price = Decimal(str(parsed.get("price")))
            if not returned_price.is_finite() or returned_price <= 0:
                return "invalid_returned_price"
        except (InvalidOperation, ValueError, TypeError, AttributeError):
            return "invalid_returned_price"
        return "returned_price_mismatch_or_unapproved_amount"

    def _call_gemini(
        self, key: str, prompt: str, response_schema: dict[str, Any], timeout: float
    ) -> str:
        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{quote(self._model, safe='')}:generateContent"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": response_schema,
                "temperature": 0.2,
            },
        }
        request = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": key},
            method="POST",
        )
        with urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
        return body["candidates"][0]["content"]["parts"][0]["text"]


_default_service: GeminiService | None = None
_default_service_lock = threading.Lock()


def get_gemini_service() -> GeminiService:
    """Return the process-wide service so key rotation spans agent turns."""
    global _default_service
    with _default_service_lock:
        if _default_service is None:
            _default_service = GeminiService()
        return _default_service
