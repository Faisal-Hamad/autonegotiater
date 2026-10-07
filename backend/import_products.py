"""Import the sample DummyJSON products for the existing demo seller.

Run from the backend directory: python import_products.py
"""
import asyncio
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal, engine
from app.models import Product, User

PRODUCTS_FILE = Path(__file__).with_name("products.json")
DEMO_SELLER_EMAIL = "seller1@demo.autonegotiater.com"
CENT = Decimal("0.01")
USD_TO_SAR = Decimal("3.75")


async def import_products() -> None:
    data = json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))

    async with SessionLocal() as session:
        seller = await session.scalar(
            select(User).where(
                User.email == DEMO_SELLER_EMAIL,
                User.role == "seller",
            )
        )
        if seller is None:
            raise RuntimeError(
                f"Demo seller {DEMO_SELLER_EMAIL} not found; run the existing seed first."
            )

        imported = 0
        for item in data["products"]:
            name = item["title"]
            category = item["category"]
            exists = await session.scalar(
                select(Product.id).where(
                    Product.seller_id == seller.id,
                    Product.name == name,
                    Product.category == category,
                )
            )
            if exists is not None:
                continue

            base_price = (Decimal(str(item["price"])) * USD_TO_SAR).quantize(
                CENT, rounding=ROUND_HALF_UP
            )
            min_price = (base_price * Decimal("0.80")).quantize(
                CENT, rounding=ROUND_HALF_UP
            )
            images = item.get("images") or []

            session.add(
                Product(
                    seller_id=seller.id,
                    name=name,
                    description=item.get("description"),
                    category=category,
                    base_price=base_price,
                    min_acceptable_price=min_price,
                    stock_quantity=max(0, int(item.get("stock", 0))),
                    image_url=item.get("thumbnail") or (images[0] if images else None),
                )
            )
            imported += 1

        await session.commit()
        print(f"Imported {imported} products for {DEMO_SELLER_EMAIL}.")


async def main() -> None:
    try:
        await import_products()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
