from decimal import Decimal
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import AuditLog, Deal, NegotiationSession, Offer, Product, SellerRule, User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ==========================================
# 1. لوحة تحكم التاجر (Seller Dashboard)
# ==========================================
@router.get("/seller")
async def get_seller_dashboard(
    seller_id: int = Query(1, description="ID of the seller"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    # التحقق من وجود التاجر
    seller = await session.get(User, seller_id)
    if not seller or seller.role != "seller":
        raise HTTPException(status_code=404, detail="Seller not found")

    # جلب منتجات هذا التاجر
    products_stmt = (
        select(Product)
        .where(Product.seller_id == seller_id)
        .order_by(Product.id.desc())
    )
    products = (await session.scalars(products_stmt)).all()
    product_ids = [p.id for p in products]

    # جلب قواعد التفاوض الخاصة بالمنتجات
    rules_stmt = select(SellerRule).where(SellerRule.product_id.in_(product_ids)) if product_ids else None
    rules_map = {}
    if rules_stmt is not None:
        rules = (await session.scalars(rules_stmt)).all()
        rules_map = {r.product_id: r for r in rules}

    # جلب جلسات التفاوض على منتجات التاجر
    sessions_stmt = (
        select(NegotiationSession)
        .where(NegotiationSession.product_id.in_(product_ids))
        .order_by(NegotiationSession.id.desc())
    ) if product_ids else None
    
    sessions = (await session.scalars(sessions_stmt)).all() if sessions_stmt is not None else []

    # إحصائيات سريعة للتاجر
    active_sessions_count = sum(1 for s in sessions if s.status == "active")
    completed_sessions_count = sum(1 for s in sessions if s.status == "completed")

    return {
        "seller": {
            "id": seller.id,
            "name": f"{seller.first_name} {seller.last_name}",
            "email": seller.email,
        },
        "stats": {
            "total_products": len(products),
            "active_negotiations": active_sessions_count,
            "completed_deals": completed_sessions_count,
        },
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "base_price": float(p.base_price),
                "min_acceptable_price": float(p.min_acceptable_price),
                "stock_quantity": p.stock_quantity,
                "has_rules": p.id in rules_map,
                "auto_accept_threshold": float(rules_map[p.id].auto_accept_threshold) if p.id in rules_map and rules_map[p.id].auto_accept_threshold else None,
                "max_rounds": rules_map[p.id].max_rounds if p.id in rules_map else None,
            }
            for p in products
        ],
        "recent_sessions": [
            {
                "id": s.id,
                "product_id": s.product_id,
                "buyer_id": s.buyer_id,
                "status": s.status,
                "mode": s.mode,
                "started_at": s.started_at.isoformat() if s.started_at else None,
            }
            for s in sessions[:10]
        ],
    }


# ==========================================
# 2. لوحة تحكم المشتري (Buyer Dashboard)
# ==========================================
@router.get("/buyer")
async def get_buyer_dashboard(
    buyer_id: int = Query(4, description="ID of the buyer (default 4 from seed)"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    buyer = await session.get(User, buyer_id)
    if not buyer or buyer.role != "buyer":
        raise HTTPException(status_code=404, detail="Buyer not found")

    # جلب كل جلسات المشتري
    sessions_stmt = (
        select(NegotiationSession)
        .where(NegotiationSession.buyer_id == buyer_id)
        .order_by(NegotiationSession.id.desc())
    )
    sessions = (await session.scalars(sessions_stmt)).all()
    session_ids = [s.id for s in sessions]

    # جلب المنتجات المرتبطة بتلك الجلسات
    product_ids = [s.product_id for s in sessions]
    products_stmt = select(Product).where(Product.id.in_(product_ids)) if product_ids else None
    products_map = {}
    if products_stmt is not None:
        prods = (await session.scalars(products_stmt)).all()
        products_map = {p.id: p for p in prods}

    # جلب الصفقات المنتهية للمشتري
    deals_stmt = (
        select(Deal)
        .where(Deal.session_id.in_(session_ids))
        .order_by(Deal.id.desc())
    ) if session_ids else None
    deals = (await session.scalars(deals_stmt)).all() if deals_stmt is not None else []

    active_count = sum(1 for s in sessions if s.status == "active")
    completed_count = sum(1 for s in sessions if s.status == "completed")

    return {
        "buyer": {
            "id": buyer.id,
            "name": f"{buyer.first_name} {buyer.last_name}",
            "email": buyer.email,
        },
        "stats": {
            "active_negotiations": active_count,
            "completed_deals": completed_count,
            "total_sessions": len(sessions),
        },
        "sessions": [
            {
                "session_id": s.id,
                "product_id": s.product_id,
                "product_name": products_map[s.product_id].name if s.product_id in products_map else "Unknown",
                "base_price": float(products_map[s.product_id].base_price) if s.product_id in products_map else 0.0,
                "max_budget": float(s.max_budget) if s.max_budget else None,
                "status": s.status,
                "mode": s.mode,
                "started_at": s.started_at.isoformat() if s.started_at else None,
            }
            for s in sessions
        ],
        "deals": [
            {
                "deal_id": d.id,
                "session_id": d.session_id,
                "final_price": float(d.final_price),
                "agreed_conditions": d.agreed_conditions,
                "buyer_confirmed": d.buyer_confirmed,
                "seller_confirmed": d.seller_confirmed,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in deals
        ],
    }


# ==========================================
# 3. لوحة تحكم مدير النظام (Admin Dashboard)
# ==========================================
@router.get("/admin")
async def get_admin_dashboard(
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    # إحصائيات عامة للنظام
    total_users = await session.scalar(select(func.count(User.id))) or 0
    total_buyers = await session.scalar(select(func.count(User.id)).where(User.role == "buyer")) or 0
    total_sellers = await session.scalar(select(func.count(User.id)).where(User.role == "seller")) or 0
    total_products = await session.scalar(select(func.count(Product.id))) or 0
    total_sessions = await session.scalar(select(func.count(NegotiationSession.id))) or 0
    active_sessions = await session.scalar(select(func.count(NegotiationSession.id)).where(NegotiationSession.status == "active")) or 0
    completed_deals = await session.scalar(select(func.count(Deal.id))) or 0

    # آخر العمليات من سجل التدقيق
    audit_stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(15)
    audit_logs = (await session.scalars(audit_stmt)).all()

    return {
        "metrics": {
            "total_users": total_users,
            "total_buyers": total_buyers,
            "total_sellers": total_sellers,
            "total_products": total_products,
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "completed_deals": completed_deals,
        },
        "recent_audit_logs": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "details": log.details,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            }
            for log in audit_logs
        ],
    }