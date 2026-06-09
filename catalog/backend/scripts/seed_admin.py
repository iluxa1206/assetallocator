"""Bootstrap an admin (superuser) — idempotent.

Run inside Docker:
    docker compose exec backend python -m scripts.seed_admin

Or locally (override DATABASE_URL to host port):
    DATABASE_URL=postgresql+asyncpg://astra:astra_dev@localhost:5434/astra \
        .venv/bin/python -m scripts.seed_admin

Env overrides:
    ADMIN_EMAIL=admin@astra.local
    ADMIN_PASSWORD=admin123
    ADMIN_NAME="Astra Admin"
"""

from __future__ import annotations

import asyncio
import os
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from fastapi_users.password import PasswordHelper

from app.core.config import settings
from app.models.user import Role, User


async def main() -> None:
    email = os.getenv("ADMIN_EMAIL", "admin@astra.local")
    password = os.getenv("ADMIN_PASSWORD", "admin123")
    name = os.getenv("ADMIN_NAME", "Astra Admin")

    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        existing = await session.scalar(select(User).where(User.email == email))
        helper = PasswordHelper()
        hashed = helper.hash(password)

        if existing:
            existing.hashed_password = hashed
            existing.is_superuser = True
            existing.is_active = True
            existing.is_verified = True
            existing.full_name = name
            existing.role = Role.MANAGER
            action = "updated"
        else:
            session.add(
                User(
                    id=uuid.uuid4(),
                    email=email,
                    hashed_password=hashed,
                    full_name=name,
                    role=Role.MANAGER,
                    is_active=True,
                    is_superuser=True,
                    is_verified=True,
                ),
            )
            action = "created"

        await session.commit()

    await engine.dispose()
    print(f"seed_admin: {action} {email} (superuser)")


if __name__ == "__main__":
    asyncio.run(main())
