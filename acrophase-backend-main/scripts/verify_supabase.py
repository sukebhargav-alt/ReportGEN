import asyncio
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv


EXPECTED_TABLES = (
    "users",
    "athletes",
    "vald_tenants",
    "vald_athletes",
    "vald_tests",
    "vald_metrics",
    "vald_sync_state",
)


async def verify() -> int:
    load_dotenv()
    load_dotenv(Path(__file__).resolve().parents[1] / "Backend.env")

    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.")
        return 1

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Prefer": "count=exact",
    }
    healthy = True

    async with httpx.AsyncClient(timeout=30) as client:
        print(f"Supabase project: {url}")
        for table in EXPECTED_TABLES:
            response = await client.get(
                f"{url}/rest/v1/{table}",
                headers=headers,
                params={"select": "*", "limit": "1"},
            )
            if response.is_success:
                count = response.headers.get("content-range", "?").split("/")[-1]
                print(f"[OK] {table}: {count} rows")
            else:
                healthy = False
                print(f"[FAIL] {table}: HTTP {response.status_code} {response.text}")

        if healthy:
            response = await client.get(
                f"{url}/rest/v1/vald_sync_state",
                headers=headers,
                params={
                    "select": "device_name,last_synced_at,updated_at",
                    "order": "device_name.asc",
                },
            )
            print(f"VALD sync state: {response.json()}")

    return 0 if healthy else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(verify()))
