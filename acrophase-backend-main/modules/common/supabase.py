import os

import httpx
from dotenv import load_dotenv

load_dotenv()
load_dotenv("Backend.env")


def get_supabase_settings() -> tuple[str, str]:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured"
        )

    return supabase_url.rstrip("/"), supabase_service_role_key


async def supabase_request(
    method: str,
    table: str,
    *,
    params: dict | None = None,
    json: dict | list | None = None,
    prefer: str | None = None,
):
    supabase_url, service_role_key = get_supabase_settings()
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    }
    if prefer:
        headers["Prefer"] = prefer

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.request(
            method,
            f"{supabase_url}/rest/v1/{table}",
            params=params,
            json=json,
            headers=headers,
        )
        response.raise_for_status()

    if not response.content:
        return None
    return response.json()
