"""Known test accounts and two competing listings, shared by the API and browser tests.

Run on an empty test database:  python -m tests.seed_data
Every account uses PASSWORD. Never run this against the production database.
"""
import asyncio
from decimal import Decimal

from sqlalchemy import insert, text

from app.db import SessionLocal
from app.models import Product, SellerRule, User
from app.routers.integration import records
from app.security import hash_password

PASSWORD = "Test-Password-123"


async def reset_and_seed():
    async with SessionLocal() as db:
        await db.execute(text(
            "TRUNCATE users, products, web_integration_records, web_auth_sessions RESTART IDENTITY CASCADE"
        ))
        users = {}
        for key, first, role in [
            ("buyer", "Test Buyer", "buyer"), ("buyer2", "Other Buyer", "buyer"),
            ("seller_a", "Seller A", "seller"), ("seller_b", "Seller B", "seller"),
            ("admin", "Test Admin", "admin"),
        ]:
            user = User(first_name=first, last_name="", email=f"{key}@test.local",
                        password_hash=hash_password(PASSWORD), role=role, is_active=True)
            db.add(user)
            users[key] = user
        await db.flush()
        # Two listings of the same model and storage, so they compete in one negotiation.
        listings = [
            ("seller_a", "3850.00", "3500.00", 5),   # floor below the buyer maximum: agents agree
            ("seller_b", "4200.00", "3900.00", 3),   # floor above the buyer maximum: buyer hits the last point
        ]
        products = {}
        for owner, price, floor, stock in listings:
            product = Product(seller_id=users[owner].id, name="iPhone 15 Pro 256GB - Natural Titanium",
                              description="Test listing", category="Electronics", base_price=Decimal(price),
                              min_acceptable_price=Decimal(floor), stock_quantity=stock)
            db.add(product)
            await db.flush()
            db.add(SellerRule(seller_id=users[owner].id, product_id=product.id, min_price=Decimal(floor),
                              max_discount=(1 - Decimal(floor) / Decimal(price)) * 100, max_rounds=6, auto_accept_threshold=None))
            await db.execute(insert(records).values(
                id=f"listing:{product.id}", kind="listing", owner_id=users[owner].id,
                data={"productId": product.id, "catalogId": str(product.id), "deliveryDays": 3,
                      "concession": float(Decimal(price) * Decimal("0.04")), "strategy": "competitive",
                      "enabled": True},
            ))
            products[owner] = product.id
        await db.commit()
        return {k: v.id for k, v in users.items()}, products


if __name__ == "__main__":
    users, products = asyncio.run(reset_and_seed())
    print("Seeded users:", users, "products:", products)
