"""Pure deterministic decision rules; each decision sees one party's limits."""

from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR

from app.negotiation.schemas import BuyerDecisionInput, Decision, SellerDecisionInput

CENT = Decimal("0.01")


def _price(value: Decimal) -> Decimal:
    value = Decimal(value)
    if not value.is_finite():
        raise ValueError("Prices must be finite")
    return value.quantize(CENT, rounding=ROUND_FLOOR)


def _seller_price(value: Decimal) -> Decimal:
    value = Decimal(value)
    if not value.is_finite():
        raise ValueError("Prices must be finite")
    return value.quantize(CENT, rounding=ROUND_CEILING)


def _validate_round(round_number: int, max_rounds: int) -> None:
    if max_rounds < 1 or round_number < 1:
        raise ValueError("Round numbers and maximum rounds must be positive")


def buyer_decision(data: BuyerDecisionInput) -> Decision:
    """Create an offer or accept a seller quote within the buyer's own budget."""
    _validate_round(data.round_number, data.max_rounds)
    target = _price(data.target_price)
    maximum = _price(data.maximum_price)
    if target <= 0 or target > maximum:
        raise ValueError("Buyer target must be positive and no greater than the budget")

    opening = _price(data.opening_price) if data.opening_price is not None else target
    if opening <= 0 or opening > target:
        raise ValueError("Buyer opening price must be positive and no greater than the target")
    progress = Decimal(data.round_number - 1) / Decimal(max(data.max_rounds - 1, 1))
    opening_cents = int((opening * 100).to_integral_value(rounding=ROUND_FLOOR))
    target_cents = int((target * 100).to_integral_value(rounding=ROUND_FLOOR))
    maximum_cents = int((maximum * 100).to_integral_value(rounding=ROUND_FLOOR))
    offer_cents = opening_cents + int(
        (Decimal(target_cents - opening_cents) * progress).to_integral_value(rounding=ROUND_FLOOR)
    )
    offer = Decimal(min(maximum_cents, offer_cents)) / 100
    if data.previous_buyer_offer is not None:
        offer = min(maximum, max(offer, _price(data.previous_buyer_offer)))
    if data.current_seller_price is not None:
        seller_price = _price(data.current_seller_price)
        acceptance_price = _price(data.acceptance_price) if data.acceptance_price is not None else offer
        if seller_price <= acceptance_price:
            return Decision("accept", seller_price, "Seller quote is within the buyer's current offer limit")
        final_acceptance_price = _price(data.acceptance_price) if data.acceptance_price is not None else maximum
        if data.round_number >= data.max_rounds and seller_price <= final_acceptance_price:
            return Decision("accept", seller_price, "Final seller quote is within the buyer's budget")
    return Decision("offer", offer, "Scheduled buyer offer within the authorized budget")


def seller_decision(data: SellerDecisionInput) -> Decision:
    """Accept an eligible buyer offer or counter within the seller's own floor."""
    _validate_round(data.round_number, data.max_rounds)
    asking = _seller_price(data.asking_price)
    minimum = _seller_price(data.minimum_price)
    buyer_offer = _price(data.current_buyer_offer)
    concession = _price(data.concession) if data.concession is not None else None
    if minimum <= 0 or asking < minimum or (data.target_price is None and (concession is None or concession <= 0)):
        raise ValueError("Seller prices and concession do not form valid boundaries")

    if data.target_price is not None:
        target = _seller_price(data.target_price)
        if target < minimum or target > asking:
            raise ValueError("Seller target must be between the minimum and asking price")
        progress = Decimal(data.round_number - 1) / Decimal(max(data.max_rounds - 1, 1))
        scheduled = asking + (target - asking) * progress
        counter = max(minimum, _seller_price(scheduled))
    else:
        counter = max(minimum, asking - concession * (data.round_number - 1))
    if data.previous_seller_price is not None:
        counter = min(counter, _seller_price(data.previous_seller_price))
    if data.competing_price is not None:
        competing = _price(data.competing_price)
        margin = max(Decimal("0.01"), (competing * Decimal("0.01")).to_integral_value(rounding=ROUND_FLOOR))
        counter = max(minimum, min(counter, competing - margin))

    threshold_met = (
        data.accept_at_threshold
        and data.auto_accept_threshold is not None
        and buyer_offer >= max(minimum, _seller_price(data.auto_accept_threshold))
    )
    if buyer_offer >= counter or threshold_met:
        return Decision("accept", buyer_offer, "Buyer offer meets the seller's minimum acceptable price")
    return Decision("counter", counter, "Scheduled seller counteroffer stays at or above the private minimum")
