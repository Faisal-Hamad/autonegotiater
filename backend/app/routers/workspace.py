from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP
import math
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import AuditLog, BuyerRequest, Deal, NegotiationSession, Offer, Product, Rating, SellerRule, User
from app.security import hash_password
from app.negotiation.buyer_agent import BuyerAgent, BuyerContext
from app.negotiation.seller_agent import SellerAgent, SellerContext
from app.negotiation.schemas import Decision

router = APIRouter(prefix="/workspace", tags=["workspace"])

CENT = Decimal("0.01")


def _q2(val: float | int | Decimal | str) -> Decimal:
    return Decimal(str(val)).quantize(CENT, rounding=ROUND_HALF_UP)


def _cents(val: float | Decimal) -> int:
    return math.floor(float(val) * 100.0 + 1e-7)


def _seller_floor(val: float | Decimal) -> int:
    return math.ceil(float(val) * 100.0 - 1e-7)


class RegisterPayload(BaseModel):
    name: str
    email: str
    role: str = "buyer"
    password: str | None = None


class ProfilePayload(BaseModel):
    name: str
    email: str


class UserStatusPayload(BaseModel):
    active: bool


class ProductPayload(BaseModel):
    seller_id: int
    name: str
    category: str
    base_price: float
    stock_quantity: int
    description: str | None = None
    image_url: str | None = None


class RulesPayload(BaseModel):
    seller_id: int
    minimum: float
    threshold: float
    discount: float
    rounds: int
    enabled: bool = True


class CreateSessionPayload(BaseModel):
    buyer_id: int
    product_id: int
    budget: float
    mode: str = "semi_automated"
    scenario: str = "agreement"
    warranty: int = 0
    delivery: str = "Buyer pickup"


class EndSessionPayload(BaseModel):
    buyer_id: int
    status: str


class RatingPayload(BaseModel):
    buyer_id: int
    rating: int
    feedback: str = ""


def _resolve_viewer_id(viewer_id: int | None = None, x_viewer_id: str | None = None) -> int | None:
    if viewer_id is not None and viewer_id > 0:
        return viewer_id
    if x_viewer_id and x_viewer_id.strip().isdigit():
        val = int(x_viewer_id.strip())
        return val if val > 0 else None
    return None


async def ensure_initial_workspace_data(session: AsyncSession) -> None:
    user_count = await session.scalar(select(func.count(User.id))) or 0
    if user_count == 0:
        pwd = hash_password("Demo@1234")
        demo_users = [
            User(first_name="Ahmed", last_name="Alharbi", email="seller1@demo.autonegotiater.com", phone="0551000001", role="seller", password_hash=pwd),
            User(first_name="Sara", last_name="Alqahtani", email="seller2@demo.autonegotiater.com", phone="0551000002", role="seller", password_hash=pwd),
            User(first_name="Khalid", last_name="Alotaibi", email="seller3@demo.autonegotiater.com", phone="0551000003", role="seller", password_hash=pwd),
            User(first_name="Noura", last_name="Alshammari", email="buyer1@demo.autonegotiater.com", phone="0551000004", role="buyer", password_hash=pwd),
            User(first_name="Faisal", last_name="Aldosari", email="buyer2@demo.autonegotiater.com", phone="0551000005", role="buyer", password_hash=pwd),
            User(first_name="Demo", last_name="Administrator", email="admin@demo.autonegotiater.com", phone="0551000006", role="admin", password_hash=pwd),
        ]
        session.add_all(demo_users)
        await session.flush()
    else:
        admin_exists = await session.scalar(select(User.id).where(User.role == "admin"))
        if not admin_exists:
            pwd = hash_password("Demo@1234")
            session.add(
                User(
                    first_name="Demo",
                    last_name="Administrator",
                    email="admin@demo.autonegotiater.com",
                    phone="0551000006",
                    role="admin",
                    password_hash=pwd,
                )
            )
            await session.flush()

    # Multi-Seller Product Listings (3 Competing Sellers per Model: iPhone 15 Pro, PS5, Samsung S24)
    sellers = (await session.scalars(select(User).where(User.role == "seller").order_by(User.id))).all()
    if len(sellers) >= 3:
        multi_seller_seed = [
            (
                sellers[0].id,
                "iPhone 15 Pro 256GB - Natural Titanium",
                "Electronics",
                Decimal("3850.00"),
                Decimal("3300.00"),
                2,
                "Natural Titanium, 95% battery health. Mint condition with zero scratches. Includes original retail box, braided USB-C cable, and 3 months remaining Jarir warranty.",
                "https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/thumbnail.webp",
            ),
            (
                sellers[1].id,
                "iPhone 15 Pro 256GB - Blue Titanium",
                "Electronics",
                Decimal("3700.00"),
                Decimal("3150.00"),
                1,
                "Blue Titanium, 89% battery health. Minor cosmetic hairline scuff on bottom bezel. Screen protector applied from day one. Includes 2 MagSafe protective cases.",
                "https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/thumbnail.webp",
            ),
            (
                sellers[2].id,
                "iPhone 15 Pro 256GB - Black Titanium",
                "Electronics",
                Decimal("3790.00"),
                Decimal("3200.00"),
                2,
                "Black Titanium, 92% battery health. Handset only (no box). Fully functional, Face ID and cameras tested 100%. Hand-to-hand pickup in Buraydah or fast courier shipping.",
                "https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/thumbnail.webp",
            ),
            (
                sellers[0].id,
                "PlayStation 5 Slim Disc Edition 1TB",
                "Electronics",
                Decimal("1950.00"),
                Decimal("1650.00"),
                2,
                "Slim Disc Edition with 1TB SSD. Comes with two DualSense wireless controllers (White & Midnight Black) and 2 physical games (EA FC 24 and Spider-Man 2). Lightly used.",
                "https://cdn.dummyjson.com/product-images/tablets/ipad-mini-2021-starlight/thumbnail.webp",
            ),
            (
                sellers[1].id,
                "PlayStation 5 Digital Edition 1TB",
                "Electronics",
                Decimal("1720.00"),
                Decimal("1480.00"),
                1,
                "Digital Edition 1TB in pristine condition. Single white DualSense controller, high-speed HDMI 2.1 cable, original power lead, and original packaging. Zero fan noise.",
                "https://cdn.dummyjson.com/product-images/tablets/ipad-mini-2021-starlight/thumbnail.webp",
            ),
            (
                sellers[2].id,
                "PlayStation 5 Disc Edition 825GB",
                "Electronics",
                Decimal("1820.00"),
                Decimal("1550.00"),
                2,
                "Original Disc model with vertical cooling charging stand included. 1 DualSense controller. Clean thermals, regularly dusted, excellent operating condition.",
                "https://cdn.dummyjson.com/product-images/tablets/ipad-mini-2021-starlight/thumbnail.webp",
            ),
            (
                sellers[0].id,
                "Samsung Galaxy S24 Ultra 256GB Titanium Gray",
                "Electronics",
                Decimal("3700.00"),
                Decimal("3150.00"),
                2,
                "Titanium Gray, 256GB, 12GB RAM. Embedded S-Pen included. Factory screen protector intact, immaculate body condition, original 45W fast wall charger and box included.",
                "https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s10/thumbnail.webp",
            ),
            (
                sellers[1].id,
                "Samsung Galaxy S24 Ultra 256GB Titanium Violet",
                "Electronics",
                Decimal("3550.00"),
                Decimal("3000.00"),
                1,
                "Titanium Violet, 256GB. Battery health excellent. Tiny surface mark near speaker grill, otherwise flawless. Comes with Samsung Smart View wallet cover.",
                "https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s10/thumbnail.webp",
            ),
            (
                sellers[2].id,
                "Samsung Galaxy S24 Ultra 512GB Titanium Black",
                "Electronics",
                Decimal("3950.00"),
                Decimal("3350.00"),
                1,
                "Upgraded 512GB storage capacity, Titanium Black. Dual SIM (nano + eSIM). Clean IMEI, fully unlocked, with official Samsung clear grip case.",
                "https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s10/thumbnail.webp",
            ),
        ]

        legacy_renames = {
            "iPhone 15 Pro 256GB": ("iPhone 15 Pro 256GB - Natural Titanium", multi_seller_seed[0]),
            "PlayStation 5 Slim": ("PlayStation 5 Slim Disc Edition 1TB", multi_seller_seed[3]),
            "Samsung Galaxy S24 Ultra": ("Samsung Galaxy S24 Ultra 256GB Titanium Gray", multi_seller_seed[6]),
        }
        for old_name, (new_name, spec) in legacy_renames.items():
            existing_legacy = await session.scalar(select(Product).where(Product.name == old_name))
            if existing_legacy:
                existing_legacy.name = new_name
                existing_legacy.description = spec[6]
                existing_legacy.base_price = spec[3]
                existing_legacy.min_acceptable_price = spec[4]
                if not existing_legacy.image_url:
                    existing_legacy.image_url = spec[7]

        existing_names = set((await session.scalars(select(Product.name))).all())
        needs_commit = False
        for s_id, p_name, p_cat, p_base, p_min, p_stock, p_desc, p_img in multi_seller_seed:
            if p_name not in existing_names:
                new_prod = Product(
                    seller_id=s_id,
                    name=p_name,
                    category=p_cat,
                    base_price=p_base,
                    min_acceptable_price=p_min,
                    stock_quantity=p_stock,
                    description=p_desc,
                    image_url=p_img,
                )
                session.add(new_prod)
                await session.flush()
                session.add(
                    SellerRule(
                        seller_id=s_id,
                        product_id=new_prod.id,
                        min_price=p_min,
                        max_discount=Decimal("20.00"),
                        max_rounds=4,
                        auto_accept_threshold=(p_base * Decimal("0.95")).quantize(CENT, rounding=ROUND_HALF_UP),
                    )
                )
                existing_names.add(p_name)
                needs_commit = True
        if needs_commit:
            await session.commit()

    products = (await session.scalars(select(Product).order_by(Product.id))).all()
    existing_rule_pids = set((await session.scalars(select(SellerRule.product_id))).all())
    for p in products:
        if p.id not in existing_rule_pids:
            session.add(
                SellerRule(
                    seller_id=p.seller_id,
                    product_id=p.id,
                    min_price=p.min_acceptable_price,
                    max_discount=Decimal("20.00"),
                    max_rounds=4,
                    auto_accept_threshold=(p.base_price * Decimal("0.95")).quantize(CENT, rounding=ROUND_HALF_UP),
                )
            )
    await session.flush()

    session_count = await session.scalar(select(func.count(NegotiationSession.id))) or 0
    if session_count == 0 and len(products) >= 1:
        buyer = await session.scalar(select(User).where(User.role == "buyer").order_by(User.id))
        if buyer:
            p1 = products[0]
            p2 = products[min(2, len(products) - 1)]

            s1 = NegotiationSession(
                buyer_id=buyer.id,
                product_id=p1.id,
                status="active",
                mode="semi_automated",
                max_budget=(p1.base_price * Decimal("0.90")).quantize(CENT, rounding=ROUND_HALF_UP),
                round_count=0,
            )
            session.add(s1)
            await session.flush()
            session.add(
                AuditLog(
                    session_id=s1.id,
                    user_id=buyer.id,
                    action="session_started",
                    details={"scenario": "agreement", "warranty": 1, "delivery": "Pickup within 3 days"},
                )
            )

            agreed_price = (p2.base_price * Decimal("0.85")).quantize(CENT, rounding=ROUND_HALF_UP)
            opening_price = (p2.base_price * Decimal("0.80")).quantize(CENT, rounding=ROUND_HALF_UP)
            s2 = NegotiationSession(
                buyer_id=buyer.id,
                product_id=p2.id,
                status="completed",
                mode="semi_automated",
                max_budget=(p2.base_price * Decimal("0.88")).quantize(CENT, rounding=ROUND_HALF_UP),
                ended_at=datetime.now(timezone.utc),
                round_count=1,
            )
            session.add(s2)
            await session.flush()

            session.add_all(
                [
                    Offer(
                        session_id=s2.id,
                        offered_by="buyer",
                        price=opening_price,
                        conditions={"action": "offer", "message": "Opening proposal for this listing."},
                        status="countered",
                        round_number=1,
                    ),
                    Offer(
                        session_id=s2.id,
                        offered_by="seller",
                        price=agreed_price,
                        conditions={"action": "counteroffer", "message": "I propose a revised price for the same terms."},
                        status="accepted",
                        round_number=1,
                    ),
                    Offer(
                        session_id=s2.id,
                        offered_by="buyer",
                        price=agreed_price,
                        conditions={"action": "accept", "message": "I accept the seller's counteroffer."},
                        status="accepted",
                        round_number=1,
                    ),
                ]
            )
            deal = Deal(
                session_id=s2.id,
                final_price=agreed_price,
                final_conditions={
                    "warranty": 0,
                    "delivery": "Buyer pickup",
                    "listing_price": float(p2.base_price),
                },
                closed_by="buyer",
                payment_status="completed",
            )
            session.add(deal)
            session.add(
                AuditLog(
                    session_id=s2.id,
                    user_id=buyer.id,
                    action="deal_completed",
                    details={"scenario": "agreement", "warranty": 0, "delivery": "Buyer pickup"},
                )
            )

    await session.commit()


async def build_workspace_state(session: AsyncSession, viewer_id: int | None = None) -> dict[str, Any]:
    # Production reads must never seed or rewrite business data.

    users = (await session.scalars(select(User).order_by(User.id))).all()
    products = (await session.scalars(select(Product).order_by(Product.id))).all()
    rules = (await session.scalars(select(SellerRule).order_by(SellerRule.id))).all()
    sessions = (await session.scalars(select(NegotiationSession).order_by(NegotiationSession.id.desc()))).all()
    offers = (await session.scalars(select(Offer).order_by(Offer.id.asc()))).all()
    deals = (await session.scalars(select(Deal).order_by(Deal.id.desc()))).all()
    ratings = (await session.scalars(select(Rating).order_by(Rating.id.desc()))).all()
    audits = (await session.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(200))).all()
    requests = (await session.scalars(select(BuyerRequest).order_by(BuyerRequest.id.desc()))).all()

    viewer = next((u for u in users if u.id == viewer_id), None) if viewer_id is not None else None

    products_by_id = {p.id: p for p in products}
    rules_by_pid = {r.product_id: r for r in rules}
    sessions_by_id = {s.id: s for s in sessions}

    disabled_pids: set[int] = set()
    seen_rule_pids: set[int] = set()
    for log in audits:
        if log.action == "rules_updated" and isinstance(log.details, dict):
            pid = log.details.get("product_id")
            if isinstance(pid, int) and pid not in seen_rule_pids:
                seen_rule_pids.add(pid)
                if log.details.get("enabled") is False:
                    disabled_pids.add(pid)

    offers_by_session: dict[int, list[Offer]] = {}
    for o in offers:
        offers_by_session.setdefault(o.session_id, []).append(o)

    session_meta: dict[int, dict[str, Any]] = {}
    for log in reversed(audits):
        if log.session_id and isinstance(log.details, dict):
            meta = session_meta.setdefault(log.session_id, {})
            meta.update(log.details)

    out_sessions = []
    for s in sessions:
        p_obj = products_by_id.get(s.product_id)
        if viewer is not None:
            if viewer.role == "buyer" and s.buyer_id != viewer.id:
                continue
            if viewer.role == "seller" and (not p_obj or p_obj.seller_id != viewer.id):
                continue

        s_offers = offers_by_session.get(s.id, [])
        meta = session_meta.get(s.id, {})
        rounds = []
        for o in s_offers:
            cond = o.conditions if isinstance(o.conditions, dict) else {}
            agent = "buyer" if o.offered_by == "buyer" else "seller"
            action = cond.get("action")
            if not action:
                if o.status == "accepted" and len(rounds) > 0:
                    action = "accept"
                elif agent == "buyer":
                    action = "offer"
                else:
                    action = "counteroffer"
            msg = cond.get("message") or (
                "I accept the proposal."
                if action == "accept"
                else "Opening proposal."
                if agent == "buyer"
                else "Counteroffer proposal."
            )
            turn: dict[str, Any] = {
                "number": o.round_number,
                "agent": agent,
                "action": action,
                "price": float(o.price),
                "message": msg,
            }
            # Utility score is confidential to the buyer (NFR-03).
            if o.utility_score is not None and (viewer is None or viewer.role == "buyer"):
                turn["utility"] = float(o.utility_score)
            if cond.get("competing_offer") is not None:
                turn["competingOffer"] = float(cond["competing_offer"])
            if cond.get("leverage_applied"):
                turn["leverageApplied"] = True
            if cond.get("scheduled_price") is not None:
                turn["scheduledPrice"] = float(cond["scheduled_price"])
            rounds.append(turn)

        ui_status = s.status
        agreed_price = None
        if s.status == "active" and rounds and rounds[-1]["action"] == "accept":
            ui_status = "awaiting_approval"
            agreed_price = rounds[-1]["price"]
        elif s.status == "completed" and rounds:
            agreed_price = rounds[-1]["price"]
        elif s.status == "cancelled" and meta.get("ui_status") == "rejected":
            ui_status = "rejected"
            if rounds:
                agreed_price = rounds[-1]["price"]
        elif s.status == "cancelled" and meta.get("ui_status") == "not_selected":
            ui_status = "not_selected"

        r_obj = rules_by_pid.get(s.product_id)
        max_rounds_val = int(r_obj.max_rounds) if r_obj else 4
        if isinstance(meta.get("privateLimits"), dict) and "rounds" in meta["privateLimits"]:
            max_rounds_val = int(meta["privateLimits"]["rounds"])

        session_dict: dict[str, Any] = {
            "id": s.id,
            "buyerId": s.buyer_id,
            "productId": s.product_id,
            "mode": s.mode,
            "status": ui_status,
            "scenario": meta.get("scenario", "agreement"),
            "warranty": int(meta.get("warranty", 0)),
            "delivery": str(meta.get("delivery", "Buyer pickup")),
            "maxRounds": max_rounds_val,
            "rounds": rounds,
            "createdAt": s.started_at.isoformat() if s.started_at else datetime.now(timezone.utc).isoformat(),
        }
        # Buyer budget is confidential to the owning buyer (NFR-03); never sent to sellers or admins.
        if viewer is None or (viewer.role == "buyer" and s.buyer_id == viewer.id):
            session_dict["budget"] = float(s.max_budget)
        if agreed_price is not None:
            session_dict["agreedPrice"] = float(agreed_price)
        if meta.get("failureReason"):
            session_dict["failureReason"] = str(meta["failureReason"])
        if s.request_id is not None:
            session_dict["requestId"] = s.request_id
        out_sessions.append(session_dict)

    out_requests = []
    for r in requests:
        if viewer is not None:
            if viewer.role == "seller":
                continue
            if viewer.role == "buyer" and r.buyer_id != viewer.id:
                continue
        prefs = r.preferences if isinstance(r.preferences, dict) else {}
        req_dict: dict[str, Any] = {
            "id": r.id,
            "buyerId": r.buyer_id,
            "mode": r.mode,
            "status": r.status,
            "priceWeight": float(prefs.get("price_weight", 0.6)),
            "productIds": [int(pid) for pid in prefs.get("ranking", [])],
            "sessionIds": sorted(s.id for s in sessions if s.request_id == r.id),
            "warranty": int(prefs.get("warranty", 0)),
            "delivery": str(prefs.get("delivery", "Buyer pickup")),
            "createdAt": r.created_at.isoformat() if r.created_at else datetime.now(timezone.utc).isoformat(),
        }
        if viewer is None or (viewer.role == "buyer" and r.buyer_id == viewer.id):
            req_dict["budget"] = float(r.max_budget)
        out_requests.append(req_dict)

    ratings_by_deal: dict[int, Rating] = {}
    for r in ratings:
        if r.deal_id not in ratings_by_deal:
            ratings_by_deal[r.deal_id] = r

    out_deals = []
    for d in deals:
        s_obj = sessions_by_id.get(d.session_id)
        p_obj = products_by_id.get(s_obj.product_id) if s_obj else None
        cond = d.final_conditions if isinstance(d.final_conditions, dict) else {}
        buyer_id_val = s_obj.buyer_id if s_obj else int(cond.get("buyer_id", 4))
        seller_id_val = p_obj.seller_id if p_obj else int(cond.get("seller_id", 1))
        if viewer is not None:
            if viewer.role == "buyer" and buyer_id_val != viewer.id:
                continue
            if viewer.role == "seller" and seller_id_val != viewer.id:
                continue
        rating_obj = ratings_by_deal.get(d.id)
        deal_dict: dict[str, Any] = {
            "id": d.id,
            "sessionId": d.session_id,
            "productId": s_obj.product_id if s_obj else int(cond.get("product_id", 1)),
            "buyerId": buyer_id_val,
            "sellerId": seller_id_val,
            "price": float(d.final_price),
            "listingPrice": float(cond.get("listing_price", p_obj.base_price if p_obj else d.final_price)),
            "warranty": int(cond.get("warranty", 0)),
            "delivery": str(cond.get("delivery", "Buyer pickup")),
            "createdAt": d.closed_at.isoformat() if d.closed_at else datetime.now(timezone.utc).isoformat(),
        }
        if rating_obj:
            deal_dict["rating"] = rating_obj.score
            if rating_obj.comment:
                deal_dict["feedback"] = rating_obj.comment
        out_deals.append(deal_dict)

    notices = []
    nid = 1
    for s in sessions[:25]:
        p_obj = products_by_id.get(s.product_id)
        s_offers = offers_by_session.get(s.id, [])
        ui_st = s.status
        if s.status == "active" and s_offers and s_offers[-1].status == "accepted":
            ui_st = "awaiting_approval"
        if ui_st in ("active", "awaiting_approval"):
            notices.append(
                {
                    "id": nid,
                    "userId": s.buyer_id,
                    "text": f"Negotiation session #{s.id} for {p_obj.name if p_obj else 'product'} is {ui_st.replace('_', ' ')}.",
                    "href": f"/dashboard/buyer/requests/{s.request_id}" if s.request_id else f"/dashboard/buyer/negotiations/{s.id}",
                    "read": False,
                }
            )
            nid += 1
            if p_obj:
                notices.append(
                    {
                        "id": nid,
                        "userId": p_obj.seller_id,
                        "text": f"Incoming negotiation #{s.id} on {p_obj.name}.",
                        "href": f"/dashboard/seller/negotiations/{s.id}",
                        "read": False,
                    }
                )
                nid += 1
    for d in deals[:25]:
        s_obj = sessions_by_id.get(d.session_id)
        p_obj = products_by_id.get(s_obj.product_id) if s_obj else None
        cond = d.final_conditions if isinstance(d.final_conditions, dict) else {}
        b_id = s_obj.buyer_id if s_obj else int(cond.get("buyer_id", 4))
        sel_id = p_obj.seller_id if p_obj else int(cond.get("seller_id", 1))
        notices.append(
            {
                "id": nid,
                "userId": b_id,
                "text": f"Agreement #{d.id} is finalized at {float(d.final_price)} SAR.",
                "href": f"/dashboard/buyer/deals/{d.id}",
                "read": False,
            }
        )
        nid += 1
        notices.append(
            {
                "id": nid,
                "userId": sel_id,
                "text": f"Sale agreement #{d.id} is ready for fulfillment.",
                "href": f"/dashboard/seller/deals/{d.id}",
                "read": False,
            }
        )
        nid += 1

    if viewer is not None:
        notices = [n for n in notices if n["userId"] == viewer.id]

    # Seller confidential rules are returned only to the owning seller (NFR-03).
    out_rules = []
    if viewer is None or viewer.role == "seller":
        for p in products:
            if viewer is not None and p.seller_id != viewer.id:
                continue
            out_rules.append(
                {
                    "productId": p.id,
                    "minimum": float(rules_by_pid[p.id].min_price) if p.id in rules_by_pid else float(p.min_acceptable_price),
                    "discount": float(rules_by_pid[p.id].max_discount) if p.id in rules_by_pid else 20.0,
                    "rounds": int(rules_by_pid[p.id].max_rounds) if p.id in rules_by_pid else 4,
                    "threshold": (
                        float(rules_by_pid[p.id].auto_accept_threshold)
                        if p.id in rules_by_pid and rules_by_pid[p.id].auto_accept_threshold is not None
                        else round(float(p.base_price) * 0.95, 2)
                    ),
                    "enabled": p.id not in disabled_pids,
                }
            )

    return {
        "products": [
            {
                "id": p.id,
                "seller_id": p.seller_id,
                "name": p.name,
                "description": p.description,
                "category": p.category,
                "base_price": f"{float(p.base_price):.2f}",
                "stock_quantity": p.stock_quantity,
                "image_url": p.image_url,
                "created_at": p.created_at.isoformat() if p.created_at else datetime.now(timezone.utc).isoformat(),
            }
            for p in products
        ],
        "users": [
            {
                "id": u.id,
                "name": f"{u.first_name} {u.last_name}".strip(),
                "email": u.email if viewer is not None and (viewer.role == "admin" or u.id == viewer.id) else "",
                "role": u.role,
                "active": u.is_active,
            }
            for u in users if viewer is not None and (viewer.role == "admin" or u.id == viewer.id or u.role == "seller")
        ],
        "rules": out_rules,
        "sessions": out_sessions,
        "requests": out_requests,
        "deals": out_deals,
        "notices": notices,
        "audit": [
            {
                "id": a.id,
                "action": a.action,
                "time": a.created_at.isoformat() if a.created_at else datetime.now(timezone.utc).isoformat(),
                "reference": a.session_id or a.user_id or a.id,
            }
            for a in audits if viewer is not None and viewer.role == "admin"
        ],
    }


@router.get("/bootstrap")
async def get_workspace_bootstrap(
    viewer_id: int | None = Query(None),
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    vid = _resolve_viewer_id(viewer_id, x_viewer_id)
    return await build_workspace_state(session, viewer_id=vid)


@router.post("/users/register")
async def register_user(payload: RegisterPayload, session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    email = payload.email.strip().lower()
    existing = await session.scalar(select(User).where(func.lower(User.email) == email))
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    parts = payload.name.strip().split(None, 1)
    first_name = parts[0] if parts else "User"
    last_name = parts[1] if len(parts) > 1 else "Account"
    role = "seller" if payload.role == "seller" else "buyer"

    user = User(
        first_name=first_name[:50],
        last_name=last_name[:50],
        email=email[:100],
        password_hash=hash_password(payload.password or "Demo@1234"),
        role=role,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    session.add(AuditLog(user_id=user.id, action="user_registered", details={"role": role, "email": email}))
    await session.commit()
    return {"user_id": user.id, "state": await build_workspace_state(session, viewer_id=user.id)}


@router.put("/users/{user_id}")
async def update_user_profile(
    user_id: int,
    payload: ProfilePayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    vid = _resolve_viewer_id(None, x_viewer_id)
    if vid is not None and vid != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own profile.")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = payload.email.strip().lower()
    conflict = await session.scalar(select(User.id).where(func.lower(User.email) == email, User.id != user_id))
    if conflict:
        raise HTTPException(status_code=400, detail="Email is already used by another account.")

    parts = payload.name.strip().split(None, 1)
    user.first_name = (parts[0] if parts else user.first_name)[:50]
    user.last_name = (parts[1] if len(parts) > 1 else "")[:50]
    user.email = email[:100]

    session.add(AuditLog(user_id=user.id, action="profile_updated", details={"email": email}))
    await session.commit()
    return await build_workspace_state(session, viewer_id=user.id)


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    payload: UserStatusPayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    vid = _resolve_viewer_id(None, x_viewer_id)
    if vid is not None:
        caller = await session.get(User, vid)
        if not caller or caller.role != "admin" or not caller.is_active:
            raise HTTPException(status_code=403, detail="Administrator authorization is required.")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = payload.active
    session.add(
        AuditLog(
            user_id=user.id,
            action="account_status_changed",
            details={"active": payload.active},
        )
    )
    await session.commit()
    return await build_workspace_state(session, viewer_id=vid)


@router.post("/products")
async def create_product(
    payload: ProductPayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    vid = _resolve_viewer_id(None, x_viewer_id)
    if vid is not None and vid != payload.seller_id:
        raise HTTPException(status_code=403, detail="Seller identity mismatch.")
    seller = await session.get(User, payload.seller_id)
    if not seller or seller.role != "seller" or not seller.is_active:
        raise HTTPException(status_code=403, detail="An active seller account is required.")

    base_price = _q2(payload.base_price)
    min_price = (base_price * Decimal("0.80")).quantize(CENT, rounding=ROUND_HALF_UP)

    product = Product(
        seller_id=payload.seller_id,
        name=payload.name.strip()[:150],
        category=payload.category.strip()[:80],
        description=payload.description.strip() if payload.description else None,
        base_price=base_price,
        min_acceptable_price=min_price,
        stock_quantity=max(0, payload.stock_quantity),
        image_url=payload.image_url.strip()[:255] if payload.image_url else None,
    )
    session.add(product)
    await session.flush()

    session.add(
        SellerRule(
            seller_id=payload.seller_id,
            product_id=product.id,
            min_price=min_price,
            max_discount=Decimal("20.00"),
            max_rounds=4,
            auto_accept_threshold=(base_price * Decimal("0.95")).quantize(CENT, rounding=ROUND_HALF_UP),
        )
    )
    session.add(
        AuditLog(
            user_id=payload.seller_id,
            action="product_created",
            details={"product_id": product.id, "name": product.name},
        )
    )
    await session.commit()
    return {"product_id": product.id, "state": await build_workspace_state(session, viewer_id=payload.seller_id)}


@router.put("/products/{product_id}")
async def update_product(
    product_id: int,
    payload: ProductPayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    vid = _resolve_viewer_id(None, x_viewer_id)
    if product.seller_id != payload.seller_id or (vid is not None and vid != product.seller_id):
        raise HTTPException(status_code=403, detail="You can only edit your own product listings.")

    base_price = _q2(payload.base_price)
    product.name = payload.name.strip()[:150]
    product.category = payload.category.strip()[:80]
    product.description = payload.description.strip() if payload.description else None
    product.base_price = base_price
    if product.min_acceptable_price > base_price:
        product.min_acceptable_price = (base_price * Decimal("0.80")).quantize(CENT, rounding=ROUND_HALF_UP)
    product.stock_quantity = max(0, payload.stock_quantity)
    product.image_url = payload.image_url.strip()[:255] if payload.image_url else None

    session.add(
        AuditLog(
            user_id=payload.seller_id,
            action="product_updated",
            details={"product_id": product.id, "base_price": float(base_price)},
        )
    )
    await session.commit()
    return await build_workspace_state(session, viewer_id=payload.seller_id)


@router.put("/products/{product_id}/rules")
async def update_product_rules(
    product_id: int,
    payload: RulesPayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    vid = _resolve_viewer_id(None, x_viewer_id)
    if product.seller_id != payload.seller_id or (vid is not None and vid != product.seller_id):
        raise HTTPException(status_code=403, detail="You can only configure rules for your own products.")

    min_price = _q2(payload.minimum)
    threshold = _q2(payload.threshold)
    discount = _q2(payload.discount)
    if min_price > product.base_price:
        raise HTTPException(status_code=400, detail="Minimum price cannot exceed product base price.")

    product.min_acceptable_price = min_price
    rule = await session.scalar(select(SellerRule).where(SellerRule.product_id == product_id))
    if rule:
        rule.min_price = min_price
        rule.auto_accept_threshold = threshold
        rule.max_discount = discount
        rule.max_rounds = payload.rounds
    else:
        session.add(
            SellerRule(
                seller_id=product.seller_id,
                product_id=product_id,
                min_price=min_price,
                auto_accept_threshold=threshold,
                max_discount=discount,
                max_rounds=payload.rounds,
            )
        )

    session.add(
        AuditLog(
            user_id=payload.seller_id,
            action="rules_updated",
            details={"product_id": product_id, "enabled": payload.enabled, "rounds": payload.rounds},
        )
    )
    await session.commit()
    return await build_workspace_state(session, viewer_id=payload.seller_id)


@router.post("/sessions")
async def create_negotiation_session(
    payload: CreateSessionPayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    vid = _resolve_viewer_id(None, x_viewer_id)
    if vid is not None and vid != payload.buyer_id:
        raise HTTPException(status_code=403, detail="Buyer identity mismatch.")
    buyer = await session.get(User, payload.buyer_id)
    if not buyer or buyer.role != "buyer" or not buyer.is_active:
        raise HTTPException(status_code=403, detail="An active buyer account is required.")
    product = await session.get(Product, payload.product_id)
    if not product or product.stock_quantity < 1:
        raise HTTPException(status_code=400, detail="Product is unavailable or out of stock.")

    mode = "automated" if payload.mode == "automated" else "semi_automated"
    neg_session = NegotiationSession(
        buyer_id=payload.buyer_id,
        product_id=payload.product_id,
        status="active",
        mode=mode,
        max_budget=_q2(payload.budget),
        round_count=0,
    )
    session.add(neg_session)
    await session.flush()

    session.add(
        AuditLog(
            session_id=neg_session.id,
            user_id=payload.buyer_id,
            action="session_started",
            details={
                "scenario": payload.scenario,
                "warranty": payload.warranty,
                "delivery": payload.delivery,
            },
        )
    )
    await session.commit()
    return {"session_id": neg_session.id, "state": await build_workspace_state(session, viewer_id=payload.buyer_id)}


async def _finalize_deal_in_db(
    session: AsyncSession, neg_session: NegotiationSession, product: Product, price: Decimal, meta: dict[str, Any], closed_by: str
) -> None:
    product = await session.scalar(select(Product).where(Product.id == product.id).with_for_update().execution_options(populate_existing=True))
    rule = await session.scalar(select(SellerRule).where(SellerRule.product_id == product.id))
    floor = max(product.min_acceptable_price, rule.min_price if rule else Decimal("0"), product.base_price * (Decimal("1") - (rule.max_discount if rule else Decimal("0")) / 100))
    if price < floor or price > neg_session.max_budget:
        raise HTTPException(status_code=409, detail="The agreed price is no longer within the authorized limits.")
    existing_deal = await session.scalar(select(Deal).where(Deal.session_id == neg_session.id))
    if existing_deal:
        return
    if product.stock_quantity < 1:
        neg_session.status = "failed"
        session.add(
            AuditLog(
                session_id=neg_session.id,
                user_id=neg_session.buyer_id,
                action="agreement_unavailable",
                details={**meta, "failureReason": "The product is out of stock."},
            )
        )
        return

    product.stock_quantity -= 1
    neg_session.status = "completed"
    neg_session.ended_at = datetime.now(timezone.utc)
    deal = Deal(
        session_id=neg_session.id,
        final_price=price,
        final_conditions={
            "warranty": int(meta.get("warranty", 0)),
            "delivery": str(meta.get("delivery", "Buyer pickup")),
            "listing_price": float(product.base_price),
            "product_id": product.id,
            "buyer_id": neg_session.buyer_id,
            "seller_id": product.seller_id,
        },
        closed_by=closed_by,
        payment_status="pending",
    )
    session.add(deal)
    session.add(
        AuditLog(
            session_id=neg_session.id,
            user_id=neg_session.buyer_id,
            action="deal_completed",
            details=meta,
        )
    )


async def _session_meta(session: AsyncSession, session_id: int) -> dict[str, Any]:
    audits = (
        await session.scalars(select(AuditLog).where(AuditLog.session_id == session_id).order_by(AuditLog.id.asc()))
    ).all()
    meta: dict[str, Any] = {"scenario": "agreement", "warranty": 0, "delivery": "Buyer pickup"}
    for log in audits:
        if isinstance(log.details, dict):
            meta.update(log.details)
    return meta


def _buyer_offer_cents(limits: dict[str, Any], round_num: int) -> int:
    opening = min(limits["buyerTarget"], max(1, math.floor(limits["asking"] * 0.55)))
    progress = 0.0 if limits["rounds"] == 1 else (round_num - 1) / (limits["rounds"] - 1)
    return math.floor(opening + (limits["buyerTarget"] - opening) * progress)


def _buyer_accepts(
    limits: dict[str, Any],
    counter_cents: int,
    previous_round: int,
    multi_seller: bool,
    competing_cents: int | None = None,
) -> bool:
    if counter_cents > limits["buyerTarget"]:
        return False
    if not multi_seller or previous_round + 1 > limits["rounds"]:
        return True
    # AC_next + Competitive Leverage: accept only if no higher than the buyer agent's own
    # next offer AND no higher than the best competing offer minus a competitive margin.
    next_offer = _buyer_offer_cents(limits, previous_round + 1)
    if competing_cents is not None:
        undercut = max(2500, math.floor(competing_cents * 0.02))
        next_offer = min(next_offer, max(1, competing_cents - undercut))
    return counter_cents <= next_offer


def _one_to_one_buyer_turn(
    offers: list[Offer], *, target: int, budget: int, asking: int, max_rounds: int,
) -> dict[str, Any]:
    """Adapt a buyer-only decision; seller private limits are not passed here."""
    last_offer = offers[-1] if offers else None
    previous_round = max((offer.round_number for offer in offers), default=0)
    opening = min(target, max(1, asking * 55 // 100))
    previous_buyer = max((int(offer.price * 100) for offer in offers if offer.offered_by == "buyer"), default=0)
    current_seller = None
    if last_offer and last_offer.offered_by == "seller":
        last_action = (last_offer.conditions or {}).get("action", "counteroffer")
        if last_action == "counteroffer":
            current_seller = last_offer.price
    decision_round = previous_round + 1
    agent = BuyerAgent(BuyerContext(
        target_price=Decimal(target) / 100,
        maximum_price=Decimal(budget) / 100,
        opening_price=Decimal(opening) / 100,
        acceptance_price=Decimal(target) / 100,
    ))
    decision = agent.decide(
        round_number=decision_round,
        max_rounds=max_rounds,
        current_seller_price=current_seller,
        previous_buyer_offer=Decimal(previous_buyer) / 100 if previous_buyer else None,
    )
    if decision.action == "accept":
        fallback = "I accept this counteroffer and the proposed conditions."
        return {"agent": "buyer", "round": last_offer.round_number, "action": "accept",
                "price": decision.price, "message": agent.respond(decision, fallback), "agreed": True}
    if decision_round > max_rounds:
        return {"exhausted_before_offer": True}
    message = ("I am opening with a lower proposal for these terms." if decision_round == 1
               else "I can increase my previous proposal to move the discussion forward.")
    message = agent.respond(decision, message)
    return {"agent": "buyer", "round": decision_round, "action": "offer", "price": decision.price,
            "message": message, "agreed": False}


def _one_to_one_seller_turn(
    offers: list[Offer], *, asking: int, floor: int, threshold: int, scenario: str, max_rounds: int,
) -> dict[str, Any]:
    """Adapt a seller-only decision; buyer budget and target are not passed here."""
    last_offer = offers[-1]
    round_num = last_offer.round_number
    target = (max(floor, (asking * 95 + 99) // 100) if scenario == "failed" else floor)
    previous_seller = min((int(offer.price * 100) for offer in offers if offer.offered_by == "seller"),
                          default=asking)
    agent = SellerAgent(SellerContext(
        asking_price=Decimal(asking) / 100,
        minimum_price=Decimal(floor) / 100,
        concession=None,
        target_price=Decimal(target) / 100,
        auto_accept_threshold=Decimal(threshold) / 100,
        accept_at_threshold=scenario != "failed",
    ))
    decision = agent.decide(
        current_buyer_offer=last_offer.price,
        round_number=round_num,
        max_rounds=max_rounds,
        previous_seller_price=Decimal(previous_seller) / 100,
    )
    if decision.action == "accept":
        fallback = "I accept the buyer's proposal and the proposed conditions."
        return {"agent": "seller", "round": round_num, "action": "accept", "price": decision.price,
                "message": agent.respond(decision, fallback), "agreed": True}
    message = ("My opening counteroffer reflects the public listing price." if round_num == 1
               else "I can reduce my previous counteroffer for these terms.")
    message = agent.respond(decision, message)
    return {"agent": "seller", "round": round_num, "action": "counteroffer", "price": decision.price,
            "message": message, "agreed": False}


async def _run_agent_turn(
    session: AsyncSession,
    neg_session: NegotiationSession,
    competing_cents: int | None = None,
) -> str:
    """Play the next agent turn of one session without committing.

    Returns "turn", "agreed", "failed" or "noop".
    When competing_cents is provided (in a multi-seller request), the buyer agent uses
    the best competing offer as leverage and the seller agent accelerates concessions
    to beat the competing offer within its confidential floor.
    """
    if neg_session.status != "active":
        return "noop"
    session_id = neg_session.id

    product = await session.get(Product, neg_session.product_id)
    rule = await session.scalar(select(SellerRule).where(SellerRule.product_id == neg_session.product_id))
    offers = (
        await session.scalars(select(Offer).where(Offer.session_id == session_id).order_by(Offer.id.asc()))
    ).all()
    meta = await _session_meta(session, session_id)

    if offers and offers[-1].status == "accepted":
        return "noop"

    rule_logs = (
        await session.scalars(
            select(AuditLog).where(AuditLog.action == "rules_updated").order_by(AuditLog.id.desc()).limit(50)
        )
    ).all()
    rule_enabled = True
    for rlog in rule_logs:
        if isinstance(rlog.details, dict) and rlog.details.get("product_id") == neg_session.product_id:
            rule_enabled = bool(rlog.details.get("enabled", True))
            break

    def fail_session(reason: str) -> str:
        neg_session.status = "failed"
        neg_session.ended_at = datetime.now(timezone.utc)
        meta["failureReason"] = reason
        session.add(
            AuditLog(
                session_id=session_id,
                user_id=neg_session.buyer_id,
                action="negotiation_failed",
                details=meta,
            )
        )
        return "failed"

    if not product or product.stock_quantity < 1:
        return fail_session("The product is unavailable. No agreement was created.")
    if not rule_enabled:
        return fail_session("The seller negotiation agent is currently disabled.")

    asking = int((product.base_price * 100).to_integral_value(rounding=ROUND_FLOOR))
    rule_min = rule.min_price if rule else product.min_acceptable_price
    rule_disc = rule.max_discount if rule else Decimal("20.00")
    max_rounds = int(rule.max_rounds) if rule else 4
    rule_thresh = (
        rule.auto_accept_threshold
        if rule and rule.auto_accept_threshold is not None
        else product.base_price
    )
    floor_price = max(rule_min, product.base_price * (Decimal("1") - rule_disc / Decimal("100")))
    floor = int((floor_price * 100).to_integral_value(rounding=ROUND_CEILING))
    budget = int((neg_session.max_budget * 100).to_integral_value(rounding=ROUND_FLOOR))
    scenario = meta.get("scenario", "agreement")

    limits = meta.get("privateLimits") or {
        "asking": asking,
        "floor": floor,
        "buyerTarget": min(budget, max(1, asking * 65 // 100)) if scenario == "failed" else budget,
        "rounds": max(1, min(20, max_rounds)),
        "threshold": max(floor, int((rule_thresh * 100).to_integral_value(rounding=ROUND_FLOOR))),
    }
    meta["privateLimits"] = limits

    if floor > limits["floor"] or asking != limits["asking"]:
        return fail_session("The listing terms changed. Start a new session to use the updated terms.")

    last_offer = offers[-1] if offers else None
    agent = "seller" if (last_offer and last_offer.offered_by == "buyer") else "buyer"
    previous_round = max((o.round_number for o in offers), default=0)

    agreed = False
    offer_conditions: dict[str, Any] = {}
    if neg_session.request_id is None:
        if agent == "buyer":
            decision = _one_to_one_buyer_turn(
                offers, target=limits["buyerTarget"], budget=budget, asking=limits["asking"],
                max_rounds=limits["rounds"],
            )
        else:
            decision = _one_to_one_seller_turn(
                offers, asking=limits["asking"], floor=limits["floor"], threshold=limits["threshold"],
                scenario=scenario, max_rounds=limits["rounds"],
            )
        if decision.get("exhausted_before_offer"):
            return fail_session("The maximum negotiation rounds were exhausted without agreement.")
        round_num = decision["round"]
        action = decision["action"]
        price_dec = decision["price"]
        message = decision["message"]
        agreed = decision["agreed"]
    else:
        # Existing database-backed request behavior remains on its current adapter.
        last_cond = (last_offer.conditions or {}) if last_offer else {}
        last_action = last_cond.get("action", "counteroffer" if last_offer and last_offer.offered_by == "seller" else "offer")
        if (
            agent == "buyer" and last_offer and last_offer.offered_by == "seller" and last_action == "counteroffer"
            and _buyer_accepts(limits, _cents(last_offer.price), previous_round, True, competing_cents)
        ):
            round_num = last_offer.round_number
            action = "accept"
            price_dec = last_offer.price
            message = "I accept this counteroffer and the proposed conditions."
            agreed = True
        elif agent == "buyer":
            round_num = previous_round + 1
            if round_num > limits["rounds"]:
                return fail_session("The maximum negotiation rounds were exhausted without agreement.")
            opening = min(limits["buyerTarget"], max(1, math.floor(limits["asking"] * 0.55)))
            scheduled_cents = _buyer_offer_cents(limits, round_num)
            prev_buyer_cents = max((_cents(o.price) for o in offers if o.offered_by == "buyer"), default=0)
            if competing_cents is not None and competing_cents < (_cents(last_offer.price) if last_offer else limits["asking"]):
                undercut = max(2500, math.floor(competing_cents * 0.02))
                leveraged_cents = max(opening, prev_buyer_cents, min(scheduled_cents, competing_cents - undercut))
                price_cents = min(limits["buyerTarget"], leveraged_cents)
                price_dec = _q2(price_cents / 100.0)
                action = "offer"
                comp_sar = competing_cents / 100.0
                message = (f"Another seller in this request is offering {comp_sar:.2f} SAR. "
                           f"I am proposing {float(price_dec):.2f} SAR — lower your price to stay competitive.")
                offer_conditions["competing_offer"] = round(comp_sar, 2)
            else:
                price_cents = max(prev_buyer_cents, scheduled_cents)
                price_dec = _q2(price_cents / 100.0)
                action = "offer"
                message = ("I am opening with a lower proposal for these terms." if round_num == 1
                           else "I can increase my previous proposal to move the discussion forward.")
        else:
            round_num = last_offer.round_number if last_offer else 1
            progress = 0.0 if limits["rounds"] == 1 else (round_num - 1) / (limits["rounds"] - 1)
            target = max(limits["floor"], math.ceil(limits["asking"] * 0.95)) if scenario == "failed" else limits["floor"]
            scheduled_cents = math.ceil(limits["asking"] + (target - limits["asking"]) * progress)
            prev_seller_cents = min((_cents(o.price) for o in offers if o.offered_by == "seller"), default=limits["asking"])
            scheduled_cents = min(scheduled_cents, prev_seller_cents)
            price_cents = scheduled_cents
            leverage_used = False
            if competing_cents is not None and scenario != "failed" and competing_cents < scheduled_cents:
                undercut = max(2500, math.floor(competing_cents * 0.02))
                competitive_target = max(limits["floor"], competing_cents - undercut)
                if competitive_target < scheduled_cents:
                    price_cents = competitive_target
                    leverage_used = True
            offer_cents = _cents(last_offer.price) if last_offer else 0
            agreed = offer_cents >= price_cents or (scenario != "failed" and offer_cents >= limits["threshold"])
            if agreed and last_offer:
                action = "accept"
                price_dec = last_offer.price
                message = "I accept the buyer's proposal and the proposed conditions."
            else:
                action = "counteroffer"
                price_dec = _q2(price_cents / 100.0)
                if leverage_used and competing_cents is not None:
                    comp_sar = competing_cents / 100.0
                    sched_sar = scheduled_cents / 100.0
                    message = (f"To compete with the {comp_sar:.2f} SAR offer from another seller, "
                               f"I lowered my counteroffer from {sched_sar:.2f} SAR to {float(price_dec):.2f} SAR.")
                    offer_conditions.update(leverage_applied=True, competing_offer=round(comp_sar, 2),
                                            scheduled_price=round(sched_sar, 2))
                else:
                    message = ("My opening counteroffer reflects the public listing price." if round_num == 1
                               else "I can reduce my previous counteroffer for these terms.")

    if neg_session.request_id is not None:
        approved_action = "counter" if action == "counteroffer" else action
        approved_decision = Decision(approved_action, price_dec, "Approved by the deterministic negotiation policy")
        if agent == "buyer":
            language_agent = BuyerAgent(BuyerContext(
                target_price=Decimal(limits["buyerTarget"]) / 100,
                maximum_price=Decimal(budget) / 100,
            ))
        else:
            language_agent = SellerAgent(SellerContext(
                asking_price=Decimal(limits["asking"]) / 100,
                minimum_price=Decimal(limits["floor"]) / 100,
            ))
        message = language_agent.respond(approved_decision, message)

    if agreed and (_cents(price_dec) > budget or _cents(price_dec) < max(limits["floor"], floor)):
        return fail_session("The terms changed and this proposal is no longer available.")

    exhausted = not agreed and agent == "seller" and round_num >= limits["rounds"] and _cents(price_dec) > limits["buyerTarget"]

    new_offer = Offer(
        session_id=session_id,
        offered_by=agent,
        price=price_dec,
        conditions={"action": action, "message": message, **offer_conditions},
        status="accepted" if agreed else "countered" if agent == "seller" else "pending",
        round_number=round_num,
    )
    session.add(new_offer)
    neg_session.round_count = round_num

    if exhausted:
        neg_session.status = "failed"
        neg_session.ended_at = datetime.now(timezone.utc)
        meta["failureReason"] = "The agents did not reach a mutually acceptable price within the allowed rounds."

    session.add(
        AuditLog(
            session_id=session_id,
            user_id=neg_session.buyer_id,
            action="agent_accepted" if agreed else "agent_turn",
            details=meta,
        )
    )
    await session.flush()
    if agreed:
        return "agreed"
    return "failed" if exhausted else "turn"


def _reject_request_session(neg_session: NegotiationSession) -> None:
    if neg_session.request_id is not None:
        raise HTTPException(
            status_code=400, detail="This session belongs to a multi-seller request; use the request actions."
        )


@router.post("/sessions/{session_id}/advance")
async def advance_negotiation_session(
    session_id: int,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    neg_session = await session.get(NegotiationSession, session_id)
    vid = _resolve_viewer_id(None, x_viewer_id)
    if not neg_session or neg_session.status != "active":
        return await build_workspace_state(session, viewer_id=vid or (neg_session.buyer_id if neg_session else None))
    if vid is not None and vid != neg_session.buyer_id:
        raise HTTPException(status_code=403, detail="Only the owning buyer can advance this session.")
    _reject_request_session(neg_session)

    outcome = await _run_agent_turn(session, neg_session)
    if outcome == "agreed" and neg_session.mode == "automated":
        product = await session.get(Product, neg_session.product_id)
        offers = (
            await session.scalars(select(Offer).where(Offer.session_id == session_id).order_by(Offer.id.asc()))
        ).all()
        meta = await _session_meta(session, session_id)
        await _finalize_deal_in_db(session, neg_session, product, offers[-1].price, meta, closed_by="system")

    await session.commit()
    return await build_workspace_state(session, viewer_id=neg_session.buyer_id)


@router.post("/sessions/{session_id}/approve")
async def approve_negotiation_session(
    session_id: int,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    neg_session = await session.get(NegotiationSession, session_id)
    vid = _resolve_viewer_id(None, x_viewer_id)
    if not neg_session or neg_session.status != "active":
        return await build_workspace_state(session, viewer_id=vid or (neg_session.buyer_id if neg_session else None))
    if vid is not None and vid != neg_session.buyer_id:
        raise HTTPException(status_code=403, detail="Only the owning buyer can approve this session.")
    _reject_request_session(neg_session)

    offers = (
        await session.scalars(select(Offer).where(Offer.session_id == session_id).order_by(Offer.id.asc()))
    ).all()
    if not offers or offers[-1].status != "accepted":
        return await build_workspace_state(session, viewer_id=neg_session.buyer_id)

    product = await session.get(Product, neg_session.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    audits = (
        await session.scalars(select(AuditLog).where(AuditLog.session_id == session_id).order_by(AuditLog.id.asc()))
    ).all()
    meta: dict[str, Any] = {"scenario": "agreement", "warranty": 0, "delivery": "Buyer pickup"}
    for log in audits:
        if isinstance(log.details, dict):
            meta.update(log.details)

    await _finalize_deal_in_db(session, neg_session, product, offers[-1].price, meta, closed_by="buyer")
    await session.commit()
    return await build_workspace_state(session, viewer_id=neg_session.buyer_id)


@router.post("/sessions/{session_id}/end")
async def end_negotiation_session(
    session_id: int,
    payload: EndSessionPayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    neg_session = await session.get(NegotiationSession, session_id)
    vid = _resolve_viewer_id(None, x_viewer_id)
    if not neg_session or neg_session.buyer_id != payload.buyer_id:
        return await build_workspace_state(session, viewer_id=vid or payload.buyer_id)
    if vid is not None and vid != neg_session.buyer_id:
        raise HTTPException(status_code=403, detail="Only the owning buyer can end this session.")
    _reject_request_session(neg_session)

    if neg_session.status != "active":
        raise HTTPException(status_code=409, detail="This session has already ended.")
    neg_session.status = "cancelled"
    neg_session.ended_at = datetime.now(timezone.utc)
    ui_status = "rejected" if payload.status == "rejected" else "cancelled"

    session.add(
        AuditLog(
            session_id=session_id,
            user_id=payload.buyer_id,
            action=f"session_{ui_status}",
            details={"ui_status": ui_status},
        )
    )
    await session.commit()
    return await build_workspace_state(session, viewer_id=payload.buyer_id)


@router.post("/deals/{deal_id}/rating")
async def save_deal_rating(
    deal_id: int,
    payload: RatingPayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    deal = await session.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    neg_session = await session.get(NegotiationSession, deal.session_id)
    vid = _resolve_viewer_id(None, x_viewer_id)
    if (neg_session and neg_session.buyer_id != payload.buyer_id) or (vid is not None and vid != payload.buyer_id):
        raise HTTPException(status_code=403, detail="Only the buyer of this agreement can submit a rating.")
    product = await session.get(Product, neg_session.product_id) if neg_session else None
    seller_id = product.seller_id if product else 1

    score = max(1, min(5, int(payload.rating)))
    comment = payload.feedback.strip()[:500] if payload.feedback else None

    existing = await session.scalar(
        select(Rating).where(Rating.deal_id == deal_id, Rating.rater_id == payload.buyer_id)
    )
    if existing:
        existing.score = score
        existing.comment = comment
    else:
        session.add(
            Rating(
                deal_id=deal_id,
                rater_id=payload.buyer_id,
                rated_id=seller_id,
                score=score,
                comment=comment,
            )
        )

    session.add(
        AuditLog(
            session_id=deal.session_id,
            user_id=payload.buyer_id,
            action="rating_saved",
            details={"deal_id": deal_id, "score": score},
        )
    )
    await session.commit()
    return await build_workspace_state(session, viewer_id=payload.buyer_id)

# ==========================================
# One buyer, many sellers (buyer requests)
# ==========================================
# The buyer picks 2-5 listings. Each listing gets its own one-to-one session with
# that seller's agent, and the buyer agent compares the results with a utility score
# while using the best current offer across sellers as competitive leverage.

MIN_REQUEST_LISTINGS = 2
MAX_REQUEST_LISTINGS = 5


class CreateRequestPayload(BaseModel):
    buyer_id: int
    product_ids: list[int]  # most preferred first
    budget: float
    mode: str = "semi_automated"
    price_weight: float = 0.6
    warranty: int = 0
    delivery: str = "Buyer pickup"


def _offer_utility(price: Decimal, budget: Decimal, rank: int, listings: int, price_weight: float) -> Decimal:
    """Buyer-side value of an offer, 0 (worst) to 1 (best)."""
    if price > budget:
        return Decimal("0")
    price_score = min(1.0, max(0.0, float(budget - price) / (float(budget) * 0.5))) if budget > 0 else 0.0
    preference_score = 1.0 if listings <= 1 else 1.0 - (rank / (listings - 1))
    value = price_weight * price_score + (1.0 - price_weight) * preference_score
    return Decimal(str(round(value, 4)))


async def _request_sessions(session: AsyncSession, request_id: int) -> list[NegotiationSession]:
    return list(
        (
            await session.scalars(
                select(NegotiationSession)
                .where(NegotiationSession.request_id == request_id)
                .order_by(NegotiationSession.id)
            )
        ).all()
    )


async def _last_offer(session: AsyncSession, session_id: int) -> Offer | None:
    return await session.scalar(
        select(Offer).where(Offer.session_id == session_id).order_by(Offer.id.desc()).limit(1)
    )


async def _last_seller_offer(session: AsyncSession, session_id: int) -> Offer | None:
    return await session.scalar(
        select(Offer)
        .where(Offer.session_id == session_id, Offer.offered_by == "seller")
        .order_by(Offer.id.desc())
        .limit(1)
    )


async def _close_request_sessions(
    session: AsyncSession, sessions: list[NegotiationSession], keep_id: int | None, ui_status: str
) -> None:
    for s in sessions:
        if s.id == keep_id or s.status != "active":
            continue
        s.status = "cancelled"
        s.ended_at = datetime.now(timezone.utc)
        session.add(
            AuditLog(
                session_id=s.id,
                user_id=s.buyer_id,
                action=f"session_{ui_status}",
                details={"ui_status": ui_status},
            )
        )


async def _finish_request(session: AsyncSession, req: BuyerRequest, chosen: NegotiationSession, closed_by: str) -> None:
    product = await session.get(Product, chosen.product_id)
    offer = await _last_offer(session, chosen.id)
    meta = await _session_meta(session, chosen.id)
    if product is None or offer is None:
        chosen.status = "failed"
    else:
        await _finalize_deal_in_db(session, chosen, product, offer.price, meta, closed_by=closed_by)
    req.status = "completed" if chosen.status == "completed" else "failed"
    req.ended_at = datetime.now(timezone.utc)


@router.post("/requests")
async def create_buyer_request(
    payload: CreateRequestPayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    vid = _resolve_viewer_id(None, x_viewer_id)
    if vid is not None and vid != payload.buyer_id:
        raise HTTPException(status_code=403, detail="Buyer identity mismatch.")
    buyer = await session.get(User, payload.buyer_id)
    if not buyer or buyer.role != "buyer" or not buyer.is_active:
        raise HTTPException(status_code=400, detail="An active buyer account is required.")

    product_ids = list(dict.fromkeys(payload.product_ids))
    if not MIN_REQUEST_LISTINGS <= len(product_ids) <= MAX_REQUEST_LISTINGS:
        raise HTTPException(
            status_code=400,
            detail=f"Select between {MIN_REQUEST_LISTINGS} and {MAX_REQUEST_LISTINGS} different listings.",
        )
    if payload.budget <= 0:
        raise HTTPException(status_code=400, detail="Budget must be greater than zero.")
    if not 0.0 <= payload.price_weight <= 1.0:
        raise HTTPException(status_code=400, detail="Price weight must be between 0 and 1.")

    products = []
    for pid in product_ids:
        product = await session.get(Product, pid)
        if not product or product.stock_quantity < 1:
            raise HTTPException(status_code=400, detail=f"Listing #{pid} is unavailable or out of stock.")
        products.append(product)

    budget = _q2(payload.budget)
    mode = "automated" if payload.mode == "automated" else "semi_automated"
    req = BuyerRequest(
        buyer_id=buyer.id,
        max_budget=budget,
        mode=mode,
        status="active",
        preferences={
            "price_weight": payload.price_weight,
            "ranking": product_ids,
            "warranty": payload.warranty,
            "delivery": payload.delivery,
        },
    )
    session.add(req)
    await session.flush()

    for product in products:
        neg_session = NegotiationSession(
            buyer_id=buyer.id,
            product_id=product.id,
            request_id=req.id,
            status="active",
            mode=mode,
            max_budget=min(budget, product.base_price),
            round_count=0,
        )
        session.add(neg_session)
        await session.flush()
        session.add(
            AuditLog(
                session_id=neg_session.id,
                user_id=buyer.id,
                action="session_started",
                details={
                    "scenario": "agreement",
                    "warranty": payload.warranty,
                    "delivery": payload.delivery,
                    "request_id": req.id,
                },
            )
        )

    session.add(
        AuditLog(
            user_id=buyer.id,
            action="request_started",
            details={"request_id": req.id, "listings": len(products), "mode": mode},
        )
    )
    await session.commit()
    return {"request_id": req.id, "state": await build_workspace_state(session, viewer_id=buyer.id)}


def _request_utility(req: BuyerRequest):
    prefs = req.preferences if isinstance(req.preferences, dict) else {}
    ranking = [int(pid) for pid in prefs.get("ranking", [])]
    price_weight = float(prefs.get("price_weight", 0.6))

    def utility(s: NegotiationSession, price: Decimal) -> Decimal:
        rank = ranking.index(s.product_id) if s.product_id in ranking else len(ranking) - 1
        return _offer_utility(price, req.max_budget, rank, len(ranking), price_weight)

    return utility


async def _agreed_offers(session: AsyncSession, sessions: list[NegotiationSession]) -> list[tuple[Offer, NegotiationSession]]:
    agreed = []
    for s in sessions:
        if s.status != "active":
            continue
        last = await _last_offer(session, s.id)
        if last is not None and last.status == "accepted":
            agreed.append((last, s))
    return agreed


@router.post("/requests/{request_id}/advance")
async def advance_buyer_request(
    request_id: int,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Play one round (buyer offer + seller response) in every session still bargaining.

    Before advancing each round, the lowest seller offer from the previous round is
    captured as anonymous competitive leverage so processing order cannot bias sellers.
    """
    req = await session.scalar(select(BuyerRequest).where(BuyerRequest.id == request_id).with_for_update())
    vid = _resolve_viewer_id(None, x_viewer_id)
    if not req or req.status != "active":
        return await build_workspace_state(session, viewer_id=vid or (req.buyer_id if req else None))
    if vid is not None and vid != req.buyer_id:
        raise HTTPException(status_code=403, detail="Only the owning buyer can advance this request.")

    sessions = await _request_sessions(session, req.id)

    # Snapshot previous-round seller quotes across all participating sessions for fair leverage.
    prev_seller_cents: dict[int, int] = {}
    for s in sessions:
        if s.status != "active":
            continue
        s_offer = await _last_seller_offer(session, s.id)
        if s_offer is not None:
            prev_seller_cents[s.id] = _cents(s_offer.price)

    for s in sessions:
        competing = min((p for sid, p in prev_seller_cents.items() if sid != s.id), default=None)
        for _ in range(2):
            if await _run_agent_turn(session, s, competing_cents=competing) != "turn":
                break

    utility = _request_utility(req)
    bargaining = False
    for s in sessions:
        if s.status != "active":
            continue
        last = await _last_offer(session, s.id)
        if last is None:
            bargaining = True
            continue
        last.utility_score = utility(s, last.price)
        if last.status != "accepted":
            bargaining = True

    if not bargaining:
        agreed = await _agreed_offers(session, sessions)
        if not agreed:
            req.status = "failed"
            req.ended_at = datetime.now(timezone.utc)
        elif req.mode == "automated":
            offer, chosen = max(agreed, key=lambda item: (item[0].utility_score or 0, -item[1].id))
            await _close_request_sessions(session, sessions, chosen.id, "not_selected")
            session.add(
                AuditLog(
                    session_id=chosen.id,
                    user_id=req.buyer_id,
                    action="request_offer_selected",
                    details={"request_id": req.id, "candidates": len(agreed), "chosen_by": "agent"},
                )
            )
            await _finish_request(session, req, chosen, closed_by="system")
        else:
            req.status = "awaiting_approval"

    await session.commit()
    return await build_workspace_state(session, viewer_id=req.buyer_id)


class ApproveRequestPayload(BaseModel):
    session_id: int | None = None


@router.post("/requests/{request_id}/approve")
async def approve_buyer_request(
    request_id: int,
    payload: ApproveRequestPayload | None = None,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    req = await session.scalar(select(BuyerRequest).where(BuyerRequest.id == request_id).with_for_update())
    vid = _resolve_viewer_id(None, x_viewer_id)
    if not req or req.status != "awaiting_approval":
        return await build_workspace_state(session, viewer_id=vid or (req.buyer_id if req else None))
    if vid is not None and vid != req.buyer_id:
        raise HTTPException(status_code=403, detail="Only the owning buyer can approve this request.")

    sessions = await _request_sessions(session, req.id)
    agreed = await _agreed_offers(session, sessions)
    if not agreed:
        req.status = "failed"
        req.ended_at = datetime.now(timezone.utc)
        await session.commit()
        return await build_workspace_state(session, viewer_id=req.buyer_id)

    chosen_id = payload.session_id if payload else None
    if chosen_id is None:
        chosen = max(agreed, key=lambda item: (item[0].utility_score or 0, -item[1].id))[1]
    else:
        chosen = next((s for _, s in agreed if s.id == chosen_id), None)
        if chosen is None:
            raise HTTPException(status_code=400, detail="Choose one of the agreed offers in this request.")

    await _close_request_sessions(session, sessions, chosen.id, "not_selected")
    session.add(
        AuditLog(
            session_id=chosen.id,
            user_id=req.buyer_id,
            action="request_offer_selected",
            details={"request_id": req.id, "candidates": len(agreed), "chosen_by": "buyer"},
        )
    )
    await _finish_request(session, req, chosen, closed_by="buyer")
    await session.commit()
    return await build_workspace_state(session, viewer_id=req.buyer_id)


@router.post("/requests/{request_id}/end")
async def end_buyer_request(
    request_id: int,
    payload: EndSessionPayload,
    x_viewer_id: str | None = Header(None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    req = await session.scalar(select(BuyerRequest).where(BuyerRequest.id == request_id).with_for_update())
    vid = _resolve_viewer_id(None, x_viewer_id)
    if not req or req.buyer_id != payload.buyer_id or req.status not in ("active", "awaiting_approval"):
        return await build_workspace_state(session, viewer_id=vid or payload.buyer_id)
    if vid is not None and vid != req.buyer_id:
        raise HTTPException(status_code=403, detail="Only the owning buyer can end this request.")

    ui_status = "rejected" if payload.status == "rejected" and req.status == "awaiting_approval" else "cancelled"
    await _close_request_sessions(session, await _request_sessions(session, req.id), None, ui_status)
    req.status = "cancelled"
    req.ended_at = datetime.now(timezone.utc)
    session.add(AuditLog(user_id=req.buyer_id, action=f"request_{ui_status}", details={"request_id": req.id}))
    await session.commit()
    return await build_workspace_state(session, viewer_id=req.buyer_id)
