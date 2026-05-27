import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()
load_dotenv("Backend.env")


@dataclass(frozen=True)
class ValdSettings:
    client_id: str
    client_secret: str
    auth_url: str
    audience: str
    region: str
    supabase_url: str
    supabase_service_role_key: str


def get_vald_settings() -> ValdSettings:
    vald_supabase_url = os.getenv("VALD_SUPABASE_URL")
    vald_service_role_key = os.getenv("VALD_SUPABASE_SERVICE_ROLE_KEY")
    if vald_supabase_url and vald_service_role_key:
        supabase_url = vald_supabase_url or ""
        service_role_key = vald_service_role_key or ""
    else:
        supabase_url = os.getenv("SUPABASE_URL", "")
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    settings = ValdSettings(
        client_id=os.getenv("VALD_CLIENT_ID", ""),
        client_secret=os.getenv("VALD_CLIENT_SECRET", ""),
        auth_url=os.getenv("VALD_AUTH_URL", "https://auth.prd.vald.com/oauth/token"),
        audience=os.getenv("VALD_AUDIENCE", "vald-api-external"),
        region=os.getenv("VALD_REGION", "aue"),
        supabase_url=supabase_url.rstrip("/"),
        supabase_service_role_key=service_role_key,
    )

    missing = [
        name
        for name, value in {
            "VALD_CLIENT_ID": settings.client_id,
            "VALD_CLIENT_SECRET": settings.client_secret,
            "SUPABASE_URL or VALD_SUPABASE_URL": settings.supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY or VALD_SUPABASE_SERVICE_ROLE_KEY": settings.supabase_service_role_key,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing VALD configuration: {', '.join(missing)}")

    return settings
