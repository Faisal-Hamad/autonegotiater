from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import math
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import AuditLog, Deal, NegotiationSession, Offer, Product, Rating, SellerRule, User
from app.security import hash_password

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


async def build_workspace_state(session: AsyncSession) -> dict[str, Any]:
    await ensure_initial_workspace_data(session)

    users = (await session.scalars(select(User).order_by(User.id))).all()
    products = (await session.scalars(select(Product).order_by(Product.id))).all()
    rules = (await session.scalars(select(SellerRule).order_by(SellerRule.id))).all()
    sessions = (await session.scalars(select(NegotiationSession).order_by(NegotiationSession.id.desc()))).all()
    offers = (await session.scalars(select(Offer).order_by(Offer.id.asc()))).all()
    deals = (await session.scalars(select(Deal).order_by(Deal.id.desc()))).all()
    ratings = (await session.scalars(select(Rating).order_by(Rating.id.desc()))).all()
    audits = (await session.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(200))).all()

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
            rounds.append(
                {
                    "number": o.round_number,
                    "agent": agent,
                    "action": action,
                    "price": float(o.price),
                    "message": msg,
                }
            )

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

        session_dict: dict[str, Any] = {
            "id": s.id,
            "buyerId": s.buyer_id,
            "productId": s.product_id,
            "budget": float(s.max_budget),
            "mode": s.mode,
            "status": ui_status,
            "scenario": meta.get("scenario", "agreement"),
            "warranty": int(meta.get("warranty", 0)),
            "delivery": str(meta.get("delivery", "Buyer pickup")),
            "rounds": rounds,
            "createdAt": s.started_at.isoformat() if s.started_at else datetime.now(timezone.utc).isoformat(),
        }
        if agreed_price is not None:
            session_dict["agreedPrice"] = float(agreed_price)
        if meta.get("failureReason"):
            session_dict["failureReason"] = str(meta["failureReason"])
        if meta.get("privateLimits"):
            session_dict["privateLimits"] = meta["privateLimits"]
        out_sessions.append(session_dict)

    ratings_by_deal: dict[int, Rating] = {}
    for r in ratings:
        if r.deal_id not in ratings_by_deal:
            ratings_by_deal[r.deal_id] = r

    out_deals = []
    for d in deals:
        s_obj = sessions_by_id.get(d.session_id)
        p_obj = products_by_id.get(s_obj.product_id) if s_obj else None
        cond = d.final_conditions if isinstance(d.final_conditions, dict) else {}
        rating_obj = ratings_by_deal.get(d.id)
        deal_dict: dict[str, Any] = {
            "id": d.id,
            "sessionId": d.session_id,
            "productId": s_obj.product_id if s_obj else int(cond.get("product_id", 1)),
            "buyerId": s_obj.buyer_id if s_obj else int(cond.get("buyer_id", 4)),
            "sellerId": p_obj.seller_id if p_obj else int(cond.get("seller_id", 1)),
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
    for s_dict in out_sessions[:15]:
        p_obj = products_by_id.get(s_dict["productId"])
        if s_dict["status"] in ("active", "awaiting_approval"):
            notices.append(
                {
                    "id": nid,
                    "userId": s_dict["buyerId"],
                    "text": f"Negotiation session #{s_dict['id']} for {p_obj.name if p_obj else 'product'} is {s_dict['status'].replace('_', ' ')}.",
                    "href": f"/dashboard/buyer/negotiations/{s_dict['id']}",
                    "read": False,
                }
            )
            nid += 1
            if p_obj:
                notices.append(
                    {
                        "id": nid,
                        "userId": p_obj.seller_id,
                        "text": f"Incoming negotiation #{s_dict['id']} on {p_obj.name}.",
                        "href": f"/dashboard/seller/negotiations/{s_dict['id']}",
                        "read": False,
                    }
                )
                nid += 1
    for d_dict in out_deals[:15]:
        notices.append(
            {
                "id": nid,
                "userId": d_dict["buyerId"],
                "text": f"Agreement #{d_dict['id']} is finalized at {d_dict['price']} SAR.",
                "href": f"/dashboard/buyer/deals/{d_dict['id']}",
                "read": False,
            }
        )
        nid += 1
        notices.append(
            {
                "id": nid,
                "userId": d_dict["sellerId"],
                "text": f"Sale agreement #{d_dict['id']} is ready for fulfillment.",
                "href": f"/dashboard/seller/deals/{d_dict['id']}",
                "read": False,
            }
        )
        nid += 1

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
                "email": u.email,
                "role": u.role,
                "active": u.is_active,
            }
            for u in users
        ],
        "rules": [
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
            for p in products
        ],
        "sessions": out_sessions,
        "deals": out_deals,
        "notices": notices,
        "audit": [
            {
                "id": a.id,
                "action": a.action,
                "time": a.created_at.isoformat() if a.created_at else datetime.now(timezone.utc).isoformat(),
                "reference": a.session_id or a.user_id or a.id,
            }
            for a in audits
        ],
    }


@router.get("/bootstrap")
async def get_workspace_bootstrap(session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    return await build_workspace_state(session)


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
    return {"user_id": user.id, "state": await build_workspace_state(session)}


@router.put("/users/{user_id}")
async def update_user_profile(
    user_id: int, payload: ProfilePayload, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
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
    return await build_workspace_state(session)


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int, payload: UserStatusPayload, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
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
    return await build_workspace_state(session)


@router.post("/products")
async def create_product(payload: ProductPayload, session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
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
    return {"product_id": product.id, "state": await build_workspace_state(session)}


@router.put("/products/{product_id}")
async def update_product(
    product_id: int, payload: ProductPayload, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

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
    return await build_workspace_state(session)


@router.put("/products/{product_id}/rules")
async def update_product_rules(
    product_id: int, payload: RulesPayload, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    product = await session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

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
    return await build_workspace_state(session)


@router.post("/sessions")
async def create_negotiation_session(
    payload: CreateSessionPayload, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
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
    return {"session_id": neg_session.id, "state": await build_workspace_state(session)}


async def _finalize_deal_in_db(
    session: AsyncSession, neg_session: NegotiationSession, product: Product, price: Decimal, meta: dict[str, Any], closed_by: str
) -> None:
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
        payment_status="completed",
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


@router.post("/sessions/{session_id}/advance")
async def advance_negotiation_session(
    session_id: int, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    neg_session = await session.get(NegotiationSession, session_id)
    if not neg_session or neg_session.status != "active":
        return await build_workspace_state(session)

    product = await session.get(Product, neg_session.product_id)
    rule = await session.scalar(select(SellerRule).where(SellerRule.product_id == neg_session.product_id))
    offers = (
        await session.scalars(select(Offer).where(Offer.session_id == session_id).order_by(Offer.id.asc()))
    ).all()

    audits = (
        await session.scalars(select(AuditLog).where(AuditLog.session_id == session_id).order_by(AuditLog.id.asc()))
    ).all()
    meta: dict[str, Any] = {"scenario": "agreement", "warranty": 0, "delivery": "Buyer pickup"}
    for log in audits:
        if isinstance(log.details, dict):
            meta.update(log.details)

    if offers and offers[-1].status == "accepted":
        return await build_workspace_state(session)

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

    async def fail_session(reason: str) -> dict[str, Any]:
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
        await session.commit()
        return await build_workspace_state(session)

    if not product or product.stock_quantity < 1:
        return await fail_session("The product is unavailable. No agreement was created.")
    if not rule_enabled:
        return await fail_session("The seller negotiation agent is currently disabled.")

    asking = _cents(product.base_price)
    rule_min = float(rule.min_price) if rule else float(product.min_acceptable_price)
    rule_disc = float(rule.max_discount) if rule else 20.0
    max_rounds = int(rule.max_rounds) if rule else 4
    rule_thresh = (
        float(rule.auto_accept_threshold)
        if rule and rule.auto_accept_threshold is not None
        else float(product.base_price)
    )
    floor = _seller_floor(max(rule_min, float(product.base_price) * (1.0 - rule_disc / 100.0)))
    budget = _cents(neg_session.max_budget)
    scenario = meta.get("scenario", "agreement")

    limits = meta.get("privateLimits") or {
        "asking": asking,
        "floor": floor,
        "buyerTarget": min(budget, max(1, math.floor(asking * 0.65))) if scenario == "failed" else budget,
        "rounds": max(1, min(20, max_rounds)),
        "threshold": max(floor, _cents(rule_thresh)),
    }
    meta["privateLimits"] = limits

    if floor > limits["floor"] or asking != limits["asking"]:
        return await fail_session("The listing terms changed. Start a new session to use the updated terms.")

    last_offer = offers[-1] if offers else None
    agent = "seller" if (last_offer and last_offer.offered_by == "buyer") else "buyer"
    previous_round = max((o.round_number for o in offers), default=0)

    agreed = False
    last_cond = (last_offer.conditions or {}) if last_offer else {}
    last_action = last_cond.get("action", "counteroffer" if last_offer and last_offer.offered_by == "seller" else "offer")

    if (
        agent == "buyer"
        and last_offer
        and last_offer.offered_by == "seller"
        and last_action == "counteroffer"
        and _cents(last_offer.price) <= limits["buyerTarget"]
    ):
        round_num = last_offer.round_number
        action = "accept"
        price_dec = last_offer.price
        message = "I accept this counteroffer and the proposed conditions."
        agreed = True
    elif agent == "buyer":
        round_num = previous_round + 1
        if round_num > limits["rounds"]:
            return await fail_session("The maximum negotiation rounds were exhausted without agreement.")
        opening = min(limits["buyerTarget"], max(1, math.floor(limits["asking"] * 0.55)))
        progress = 0.0 if limits["rounds"] == 1 else (round_num - 1) / (limits["rounds"] - 1)
        price_cents = math.floor(opening + (limits["buyerTarget"] - opening) * progress)
        price_dec = _q2(price_cents / 100.0)
        action = "offer"
        message = (
            "I am opening with a lower proposal for these terms."
            if round_num == 1
            else "I can increase my previous proposal to move the discussion forward."
        )
    else:
        round_num = last_offer.round_number if last_offer else 1
        progress = 0.0 if limits["rounds"] == 1 else (round_num - 1) / (limits["rounds"] - 1)
        target = (
            max(limits["floor"], math.ceil(limits["asking"] * 0.95))
            if scenario == "failed"
            else limits["floor"]
        )
        price_cents = math.ceil(limits["asking"] + (target - limits["asking"]) * progress)
        offer_cents = _cents(last_offer.price) if last_offer else 0
        agreed = offer_cents >= price_cents or (scenario != "failed" and offer_cents >= limits["threshold"])
        if agreed and last_offer:
            action = "accept"
            price_dec = last_offer.price
            message = "I accept the buyer's proposal and the proposed conditions."
        else:
            action = "counteroffer"
            price_dec = _q2(price_cents / 100.0)
            message = (
                "My opening counteroffer reflects the public listing price."
                if round_num == 1
                else "I can reduce my previous counteroffer for these terms."
            )

    if agreed and (_cents(price_dec) > budget or _cents(price_dec) < max(limits["floor"], floor)):
        return await fail_session("The terms changed and this proposal is no longer available.")

    exhausted = not agreed and agent == "seller" and round_num >= limits["rounds"] and _cents(price_dec) > limits["buyerTarget"]

    new_offer = Offer(
        session_id=session_id,
        offered_by=agent,
        price=price_dec,
        conditions={"action": action, "message": message},
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

    if agreed and neg_session.mode == "automated":
        await _finalize_deal_in_db(session, neg_session, product, price_dec, meta, closed_by="system")

    await session.commit()
    return await build_workspace_state(session)


@router.post("/sessions/{session_id}/approve")
async def approve_negotiation_session(
    session_id: int, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    neg_session = await session.get(NegotiationSession, session_id)
    if not neg_session or neg_session.status != "active":
        return await build_workspace_state(session)

    offers = (
        await session.scalars(select(Offer).where(Offer.session_id == session_id).order_by(Offer.id.asc()))
    ).all()
    if not offers or offers[-1].status != "accepted":
        return await build_workspace_state(session)

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
    return await build_workspace_state(session)


@router.post("/sessions/{session_id}/end")
async def end_negotiation_session(
    session_id: int, payload: EndSessionPayload, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    neg_session = await session.get(NegotiationSession, session_id)
    if not neg_session or neg_session.buyer_id != payload.buyer_id:
        return await build_workspace_state(session)

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
    return await build_workspace_state(session)


@router.post("/deals/{deal_id}/rating")
async def save_deal_rating(
    deal_id: int, payload: RatingPayload, session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    deal = await session.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    neg_session = await session.get(NegotiationSession, deal.session_id)
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
    return await build_workspace_state(session)