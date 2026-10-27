"""Idempotently add demo users, products and catalog choices.

Run inside the fastapi container:  python seed.py
Repeated runs preserve existing rows and add only missing seeded entries.
"""
import asyncio
import json
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal, engine
from app.models import Product, SellerRule, User
from app.security import hash_password

DEMO_PASSWORD = "Demo@1234"
PRODUCTS_FILE = Path(__file__).with_name("products.json")

USERS = [
    ("Ahmed", "Alharbi", "seller1@demo.autonegotiater.com", "0551000001", "seller"),
    ("Sara", "Alqahtani", "seller2@demo.autonegotiater.com", "0551000002", "seller"),
    ("Khalid", "Alotaibi", "seller3@demo.autonegotiater.com", "0551000003", "seller"),
    ("Noura", "Alshammari", "buyer1@demo.autonegotiater.com", "0551000004", "buyer"),
    ("Faisal", "Aldosari", "buyer2@demo.autonegotiater.com", "0551000005", "buyer"),
]

# (seller index, name, category, base price SAR, min acceptable %, stock, description)
PRODUCTS = [
    # iPhone 15 Pro (3 competing sellers)
    (0, "iPhone 15 Pro 256GB - Natural Titanium", "Electronics", 3850, 0.85, 2, "Natural Titanium, 95% battery health. Mint condition with zero scratches. Includes original retail box, braided USB-C cable, and 3 months remaining Jarir warranty."),
    (1, "iPhone 15 Pro 256GB - Blue Titanium", "Electronics", 3700, 0.85, 1, "Blue Titanium, 89% battery health. Minor cosmetic hairline scuff on bottom bezel. Screen protector applied from day one. Includes 2 MagSafe protective cases."),
    (2, "iPhone 15 Pro 256GB - Black Titanium", "Electronics", 3790, 0.84, 2, "Black Titanium, 92% battery health. Handset only (no box). Fully functional, Face ID and cameras tested 100%. Hand-to-hand pickup in Buraydah or fast courier shipping."),
    # PlayStation 5 (3 competing sellers)
    (0, "PlayStation 5 Slim Disc Edition 1TB", "Electronics", 1950, 0.84, 2, "Slim Disc Edition with 1TB SSD. Comes with two DualSense wireless controllers (White & Midnight Black) and 2 physical games (EA FC 24 and Spider-Man 2). Lightly used."),
    (1, "PlayStation 5 Digital Edition 1TB", "Electronics", 1720, 0.85, 1, "Digital Edition 1TB in pristine condition. Single white DualSense controller, high-speed HDMI 2.1 cable, original power lead, and original packaging. Zero fan noise."),
    (2, "PlayStation 5 Disc Edition 825GB", "Electronics", 1820, 0.85, 2, "Original Disc model with vertical cooling charging stand included. 1 DualSense controller. Clean thermals, regularly dusted, excellent operating condition."),
    # Samsung Galaxy S24 Ultra (3 competing sellers)
    (0, "Samsung Galaxy S24 Ultra 256GB Titanium Gray", "Electronics", 3700, 0.85, 2, "Titanium Gray, 256GB, 12GB RAM. Embedded S-Pen included. Factory screen protector intact, immaculate body condition, original 45W fast wall charger and box included."),
    (1, "Samsung Galaxy S24 Ultra 256GB Titanium Violet", "Electronics", 3550, 0.84, 1, "Titanium Violet, 256GB. Battery health excellent. Tiny surface mark near speaker grill, otherwise flawless. Comes with Samsung Smart View wallet cover."),
    (2, "Samsung Galaxy S24 Ultra 512GB Titanium Black", "Electronics", 3950, 0.84, 1, "Upgraded 512GB storage capacity, Titanium Black. Dual SIM (nano + eSIM). Clean IMEI, fully unlocked, with official Samsung clear grip case."),
    # Other electronics
    (0, "MacBook Air M2 13-inch", "Electronics", 3800, 0.80, 1, "8GB RAM, 256GB SSD, 120 battery cycles."),
    (0, "Sony WH-1000XM5 Headphones", "Electronics", 950, 0.75, 3, "Noise cancelling, like new."),
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
        existing_users = {u.email: u for u in (await session.scalars(select(User))).all()}
        new_users = []
        password_hash = hash_password(DEMO_PASSWORD)
        for first, last, email, phone, role in USERS:
            if email not in existing_users:
                user = User(first_name=first, last_name=last, email=email, phone=phone, role=role, password_hash=password_hash)
                session.add(user)
                new_users.append(user)
                existing_users[email] = user
        await session.flush()
        users = [existing_users[email] for _, _, email, _, _ in USERS]

        existing_names = set((await session.execute(select(Product.name, Product.category))).all())
        seeded_products = []
        # Keep the original demo inventory and only add entries that are absent.
        for seller_idx, name, category, base, min_pct, stock, description in PRODUCTS:
            if (name, category) in existing_names:
                continue
            base_price = Decimal(base).quantize(Decimal("0.01"))
            product = Product(
                seller_id=users[seller_idx].id,
                name=name,
                description=description,
                category=category,
                base_price=base_price,
                min_acceptable_price=(base_price * Decimal(str(min_pct))).quantize(Decimal("0.01")),
                stock_quantity=stock,
            )
            session.add(product)
            seeded_products.append(product)
            existing_names.add((name, category))
        await session.flush()

        # These rows are the shared catalog templates used by the seller listing dropdown.
        # Listings created from a template get their own Product ID while model/storage
        # matching resolves them to the same canonical identity.
        data = json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))
        catalog_items = [item for item in data.get("products", []) if item.get("catalog_variant") is True]
        catalog_products = []
        seller_id = users[0].id
        for item in catalog_items:
            name = item["title"].strip()[:150]
            category = item["category"]
            if (name, category) in existing_names:
                continue
            base_price = (Decimal(str(item.get("price", 100))) * Decimal("3.75")).quantize(Decimal("0.01"))
            catalog_products.append(Product(
                seller_id=seller_id,
                name=name,
                description=item.get("description"),
                category=category,
                base_price=base_price,
                min_acceptable_price=(base_price * Decimal("0.80")).quantize(Decimal("0.01")),
                stock_quantity=0,
                image_url=item.get("thumbnail"),
            ))
            existing_names.add((name, category))
        session.add_all(catalog_products)
        await session.flush()

        if seeded_products:
            for product in seeded_products[::2][:10]:
                session.add(SellerRule(
                    seller_id=product.seller_id,
                    product_id=product.id,
                    min_price=product.min_acceptable_price,
                    max_discount=Decimal("20.00"),
                    max_rounds=6,
                    auto_accept_threshold=(product.base_price * Decimal("0.95")).quantize(Decimal("0.01")),
                ))

        await session.commit()
        print(f"Ensured {len(users)} demo users; added {len(seeded_products)} demo products and {len(catalog_products)} iPhone catalog variants.")


async def main() -> None:
    try:
        await seed()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
