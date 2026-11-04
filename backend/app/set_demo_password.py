"""Give the demo accounts a private shared password for demonstrations.

Run inside the backend container after setting DEMO_ACCOUNT_PASSWORD in the
server .env file:  python -m app.set_demo_password
The password is read from the environment only, so it never enters the repository.
"""
import asyncio
import os
import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.integration_auth import BLOCKED_PASSWORDS
from app.models import User
from app.security import hash_password

DEMO_DOMAIN = "@demo.autonegotiater.com"


async def main() -> int:
    password = os.getenv("DEMO_ACCOUNT_PASSWORD", "")
    if len(password) < 12 or password in BLOCKED_PASSWORDS:
        print("Set DEMO_ACCOUNT_PASSWORD (at least 12 characters) in the .env file first.")
        return 1
    async with SessionLocal() as db:
        users = (await db.scalars(select(User).where(User.email.endswith(DEMO_DOMAIN)))).all()
        for user in users:
            user.password_hash = hash_password(password)
            user.is_active = True
        await db.commit()
    for user in users:
        print(f"Updated {user.email} ({user.role})")
    print(f"{len(users)} demo accounts updated.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
