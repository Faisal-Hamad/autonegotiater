"""Fill the database with fake users, products and seller rules.

Run inside the fastapi container:  python seed.py
Safe to run twice: it does nothing if users already exist.
"""
import asyncio
from decimal import Decimal

from sqlalchemy import func, select

from app.db import SessionLocal, engine
from app.models import Product, SellerRule, User
from app.security import hash_password

DEMO_PASSWORD = "Demo@1234"

USERS = [
    ("Ahmed", "Alharbi", "seller1@demo.autonegotiater.com", "0551000001", "seller"),
    ("Sara", "Alqahtani", "seller2@demo.autonegotiater.com", "0551000002", "seller"),
    ("Khalid", "Alotaibi", "seller3@demo.autonegotiater.com", "0551000003", "seller"),
    ("Noura", "Alshammari", "buyer1@demo.autonegotiater.com", "0551000004", "buyer"),
    ("Faisal", "Aldosari", "buyer2@demo.autonegotiater.com", "0551000005", "buyer"),
]

# (seller index, name, category, base price SAR, min acceptable %, stock, description)
PRODUCTS = [
    (0, "iPhone 15 Pro 256GB", "Electronics", 3900, 0.85, 2, "Used 8 months, battery health 94%, with box."),
    (0, "Samsung Galaxy S24 Ultra", "Electronics", 3600, 0.82, 1, "Titanium gray, minor scratches on frame."),
    (0, "MacBook Air M2 13\"", "Electronics", 3800, 0.80, 1, "8GB RAM, 256GB SSD, 120 battery cycles."),
    (0, "Sony WH-1000XM5 Headphones", "Electronics", 950, 0.75, 3, "Noise cancelling, like new."),
    (0, "PlayStation 5 Slim", "Electronics", 1900, 0.85, 2, "Disc edition with two controllers."),
    (1, "L-Shaped Sofa (Grey)", "Furniture", 2200, 0.70, 1, "5-seater fabric sofa, 2 years old."),
    (1, "Dining Table with 6 Chairs", "Furniture", 1800, 0.75, 1, "Solid wood, pickup from Riyadh."),
    (1, "Office Chair Ergonomic", "Furniture", 650, 0.80, 4, "Mesh back, adjustable arms and lumbar support."),
    (1, "King Size Bed Frame", "Furniture", 1400, 0.72, 2, "Upholstered headboard, mattress not included."),
    (1, "TV Stand Walnut 180cm", "Furniture", 480, 0.80, 3, "Two drawers, fits up to 75\" TV."),
    (2, "Toyota Camry 2019 Alloy Rims", "Vehicles/Parts", 1200, 0.78, 1, "Set of 4, 17 inch, with tires."),
    (2, "Car Dash Camera 4K", "Vehicles/Parts", 450, 0.80, 5, "Front and rear, GPS, 64GB card included."),
    (2, "Hyundai Elantra Headlights", "Vehicles/Parts", 850, 0.75, 2, "Original LED pair, 2021 model."),
    (2, "Portable Jump Starter", "Vehicles/Parts", 320, 0.85, 6, "2000A, works as a power bank too."),
    (2, "Roof Rack Cross Bars", "Vehicles/Parts", 380, 0.80, 3, "Universal fit, aluminium."),
    (0, "Samsung 55\" QLED TV", "Home Appliances", 2100, 0.80, 2, "4K, 2023 model, wall mount included."),
    (1, "LG Front Load Washer 9kg", "Home Appliances", 1650, 0.75, 1, "Inverter motor, steam wash."),
    (2, "Split AC 18000 BTU", "Home Appliances", 2300, 0.82, 2, "Gree, inverter, installation not included."),
    (0, "Dyson V12 Vacuum", "Home Appliances", 1900, 0.80, 1, "Cordless, all attachments, 1 year old."),
    (1, "De'Longhi Espresso Machine", "Home Appliances", 1250, 0.78, 2, "Magnifica S, automatic bean to cup."),
    (2, "Treadmill Foldable", "Sports", 1700, 0.70, 1, "Max speed 14 km/h, 120kg capacity."),
    (0, "Mountain Bike 29\"", "Sports", 1300, 0.75, 2, "Aluminium frame, 21 speeds, hydraulic brakes."),
    (1, "Adjustable Dumbbells 24kg", "Sports", 900, 0.80, 3, "Pair, quick weight change dial."),
    (2, "Padel Racket Bullpadel", "Sports", 750, 0.85, 4, "Vertex 03, used a few times."),
    (0, "Camping Tent 6 Person", "Sports", 550, 0.75, 3, "Waterproof, easy setup, with carry bag."),
]


async def seed() -> None:
    async with SessionLocal() as session:
        if await session.scalar(select(func.count(User.id))):
            print("Database already has users, skipping seed.")
            return

        password_hash = hash_password(DEMO_PASSWORD)
        users = [
            User(first_name=first, last_name=last, email=email, phone=phone, role=role, password_hash=password_hash)
            for first, last, email, phone, role in USERS
        ]
        session.add_all(users)
        await session.flush()

        products = []
        for seller_idx, name, category, base, min_pct, stock, description in PRODUCTS:
            base_price = Decimal(base).quantize(Decimal("0.01"))
            products.append(Product(
                seller_id=users[seller_idx].id,
                name=name,
                description=description,
                category=category,
                base_price=base_price,
                min_acceptable_price=(base_price * Decimal(str(min_pct))).quantize(Decimal("0.01")),
                stock_quantity=stock,
            ))
        session.add_all(products)
        await session.flush()

        # Negotiation rules for the first product of every two, ready for week 5.
        for product in products[::2][:10]:
            session.add(SellerRule(
                seller_id=product.seller_id,
                product_id=product.id,
                min_price=product.min_acceptable_price,
                max_discount=Decimal("20.00"),
                max_rounds=6,
                auto_accept_threshold=(product.base_price * Decimal("0.95")).quantize(Decimal("0.01")),
            ))

        await session.commit()
        print(f"Seeded {len(users)} users, {len(products)} products, 10 seller rules. Password: {DEMO_PASSWORD}")


async def main() -> None:
    try:
        await seed()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
