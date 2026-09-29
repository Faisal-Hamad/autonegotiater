from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Product
from app.schemas.product import ProductPublic

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductPublic])
async def list_products(category: str | None = None, session: AsyncSession = Depends(get_session)):
    query = select(Product).order_by(Product.id)
    if category:
        query = query.where(Product.category == category)
    return (await session.scalars(query)).all()


@router.get("/{product_id}", response_model=ProductPublic)
async def get_product(product_id: int, session: AsyncSession = Depends(get_session)):
    product = await session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
