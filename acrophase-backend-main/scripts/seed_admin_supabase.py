import os
import sys
import asyncio

import bcrypt
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.common.supabase import supabase_request

load_dotenv()
load_dotenv("Backend.env")


def get_hashed_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def seed_admin():
    admin_email = os.getenv("ADMIN_EMAIL", "admin@acrophase.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "AdminPassword123!")
    full_name = os.getenv("ADMIN_FULL_NAME", "System Admin")

    admin_data = {
        "email": admin_email,
        "hashed_password": get_hashed_password(admin_password),
        "full_name": full_name,
        "is_admin": True,
        "is_active": True,
    }

    existing = await supabase_request(
        "GET",
        "users",
        params={"select": "id", "email": f"eq.{admin_email}", "limit": "1"},
    )

    if existing:
        await supabase_request(
            "PATCH",
            "users",
            params={"email": f"eq.{admin_email}"},
            json=admin_data,
        )
        print(f"Updated admin user: {admin_email}")
    else:
        await supabase_request("POST", "users", json=admin_data)
        print(f"Created admin user: {admin_email}")

    print("Admin user seeded successfully.")


if __name__ == "__main__":
    asyncio.run(seed_admin())
