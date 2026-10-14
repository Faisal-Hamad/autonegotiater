"""Clean non-C2C items and import DummyJSON products mapped to the 5 project categories.

Categories:
- Electronics
- Furniture
- Vehicles/Parts
- Home Appliances
- Sports

Run inside the fastapi container: python import_products.py
"""
import asyncio
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import urllib.request

from sqlalchemy import delete, select

from app.db import SessionLocal, engine
from app.models import Product, SellerRule, User

PRODUCTS_FILE = Path(__file__).with_name("products.json")
CENT = Decimal("0.01")
USD_TO_SAR = Decimal("3.75")

VALID_CATEGORIES = ("Electronics", "Furniture", "Vehicles/Parts", "Home Appliances", "Sports")

DUMMYJSON_CATEGORY_MAP = {
    "smartphones": "Electronics",
    "laptops": "Electronics",
    "tablets": "Electronics",
    "furniture": "Furniture",
    "vehicle": "Vehicles/Parts",
    "motorcycle": "Vehicles/Parts",
    "home-decoration": "Home Appliances",
    "kitchen-accessories": "Home Appliances",
    "sports-accessories": "Sports",
}

CATEGORY_SELLER_EMAIL = {
    "Electronics": "seller1@demo.autonegotiater.com",
    "Furniture": "seller2@demo.autonegotiater.com",
    "Home Appliances": "seller2@demo.autonegotiater.com",
    "Vehicles/Parts": "seller3@demo.autonegotiater.com",
    "Sports": "seller3@demo.autonegotiater.com",
}

SEED_IMAGE_MAP = {
    "Electronics": "https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/thumbnail.webp",
    "Furniture": "https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp",
    "Vehicles/Parts": "https://cdn.dummyjson.com/product-images/vehicle/charger-sxt-rwd/thumbnail.webp",
    "Home Appliances": "https://cdn.dummyjson.com/product-images/kitchen-accessories/microwave-oven/thumbnail.webp",
    "Sports": "https://cdn.dummyjson.com/product-images/sports-accessories/tennis-racket/thumbnail.webp",
}


def load_or_fetch_products() -> list[dict]:
    fetched_items: list[dict] = []
    try:
        for api_cat, project_cat in DUMMYJSON_CATEGORY_MAP.items():
            url = f"https://dummyjson.com/products/category/{api_cat}?limit=4"
            req = urllib.request.Request(url, headers={"User-Agent": "AutoNegotiater/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
                for item in payload.get("products", [])[:4]:
                    item["category"] = project_cat
                    fetched_items.append(item)
        if fetched_items:
            PRODUCTS_FILE.write_text(
                json.dumps({"products": fetched_items, "total": len(fetched_items), "skip": 0, "limit": len(fetched_items)}, indent=2),
                encoding="utf-8",
            )
            return fetched_items
    except Exception:
        pass

    data = json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))
    items = []
    for item in data.get("products", []):
        raw_cat = item.get("category", "")
        mapped_cat = DUMMYJSON_CATEGORY_MAP.get(raw_cat.lower(), raw_cat)
        if mapped_cat in VALID_CATEGORIES:
            item["category"] = mapped_cat
            items.append(item)
    return items


async def import_products() -> None:
    items = load_or_fetch_products()

    async with SessionLocal() as session:
        # 1. Remove any products outside our 5 official C2C categories (e.g. beauty, groceries, fragrances)
        removed_result = await session.execute(
            delete(Product).where(Product.category.notin_(VALID_CATEGORIES))
        )
        removed_count = removed_result.rowcount or 0

        # 2. Load demo sellers by email
        sellers_rows = (await session.scalars(select(User).where(User.role == "seller"))).all()
        if not sellers_rows:
            raise RuntimeError("No sellers found in database; run python seed.py first.")
        sellers_by_email = {u.email: u for u in sellers_rows}
        default_seller = sellers_rows[0]

        # 3. Ensure existing seeded products have a fallback image_url if missing
        existing_products = (await session.scalars(select(Product))).all()
        for p in existing_products:
            if not p.image_url and p.category in SEED_IMAGE_MAP:
                p.image_url = SEED_IMAGE_MAP[p.category]

        imported = 0
        for item in items:
            name = item["title"].strip()[:150]
            category = item["category"]
            if category not in VALID_CATEGORIES:
                continue

            seller_email = CATEGORY_SELLER_EMAIL.get(category, default_seller.email)
            seller = sellers_by_email.get(seller_email, default_seller)

            exists = await session.scalar(
                select(Product.id).where(
                    Product.name == name,
                    Product.category == category,
                )
            )
            if exists is not None:
                continue

            raw_price = Decimal(str(item.get("price", 100)))
            base_price = (raw_price * USD_TO_SAR).quantize(CENT, rounding=ROUND_HALF_UP)
            if base_price < Decimal("50.00"):
                base_price = (base_price * Decimal("5.00")).quantize(CENT, rounding=ROUND_HALF_UP)

            min_price = (base_price * Decimal("0.80")).quantize(CENT, rounding=ROUND_HALF_UP)
            images = item.get("images") or []
            img_url = item.get("thumbnail") or (images[0] if images else SEED_IMAGE_MAP.get(category))

            new_product = Product(
                seller_id=seller.id,
                name=name,
                description=item.get("description"),
                category=category,
                base_price=base_price,
                min_acceptable_price=min_price,
                stock_quantity=max(1, min(10, int(item.get("stock", 2)))),
                image_url=img_url,
            )
            session.add(new_product)
            await session.flush()

            session.add(
                SellerRule(
                    seller_id=seller.id,
                    product_id=new_product.id,
                    min_price=min_price,
                    max_discount=Decimal("20.00"),
                    max_rounds=4,
                    auto_accept_threshold=(base_price * Decimal("0.95")).quantize(CENT, rounding=ROUND_HALF_UP),
                )
            )
            imported += 1

        await session.commit()
        print(
            f"Cleaned {removed_count} non-C2C items (beauty/groceries/fragrances). "
            f"Imported {imported} C2C products across {list(VALID_CATEGORIES)}."
        )


async def main() -> None:
    try:
        await import_products()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())