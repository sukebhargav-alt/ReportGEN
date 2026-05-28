from __future__ import annotations

import asyncio
import time
from typing import Any
from urllib.parse import urlencode

import httpx

from modules.vald.config import get_vald_settings


class ValdApiClient:
    def __init__(self):
        self.settings = get_vald_settings()
        self._token: str | None = None
        self._token_expires_at = 0.0

    async def get_token(self) -> str:
        if self._token and time.time() < self._token_expires_at - 60:
            return self._token

        data = {
            "grant_type": "client_credentials",
            "client_id": self.settings.client_id,
            "client_secret": self.settings.client_secret,
            "audience": self.settings.audience,
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                self.settings.auth_url,
                data=data,
                headers=headers,
            )
            response.raise_for_status()

        payload = response.json()
        self._token = payload["access_token"]
        self._token_expires_at = time.time() + int(payload.get("expires_in", 3600))
        return self._token

    def host(self, service: str) -> str:
        return f"https://prd-{self.settings.region}-api-{service}.valdperformance.com"

    async def request(self, url: str) -> Any:
        token = await self.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        delay = 1.0

        for attempt in range(3):
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(url, headers=headers)

            if response.status_code == 204:
                return None
            if response.status_code not in {429, 500, 502, 503, 504}:
                response.raise_for_status()
                return response.json()
            if attempt == 2:
                response.raise_for_status()

            await asyncio.sleep(delay)
            delay *= 2

        return None

    async def tenants(self) -> list[dict[str, Any]]:
        payload = await self.request(f"{self.host('externaltenants')}/tenants")
        return normalize_list(payload)

    async def profiles(
        self, tenant_id: str, profile_ids: list[str] | None = None
    ) -> list[dict[str, Any]]:
        query: dict[str, str] = {"tenantId": tenant_id}
        if profile_ids:
            query["profileIds"] = ",".join(profile_ids)
        payload = await self.request(
            f"{self.host('externalprofile')}/profiles?{urlencode(query)}"
        )
        return normalize_list(payload)

    async def dynamo_tests(self, tenant_id: str, modified_from: str, page: int) -> Any:
        query = urlencode({"modifiedFromUTC": modified_from, "page": page})
        return await self.request(
            f"{self.host('extdynamo')}/v2022q2/teams/{tenant_id}/tests"
            f"?{query}"
        )

    async def dynamo_detail(self, tenant_id: str, test_id: str) -> Any:
        return await self.request(
            f"{self.host('extdynamo')}/v2022q2/teams/{tenant_id}/tests/{test_id}"
        )

    async def forcedecks_tests(
        self, tenant_id: str, date_from: str, date_to: str, page: int
    ) -> Any:
        return await self.request(
            f"{self.host('extforcedecks')}/v2019q3/teams/{tenant_id}/tests/"
            f"{date_from}/{date_to}/{page}"
        )

    async def forcedecks_trials(
        self, tenant_id: str, test_id: str, trials_url: str | None = None
    ) -> Any:
        if trials_url and trials_url.startswith("/"):
            trials_url = f"{self.host('extforcedecks')}{trials_url}"
        return await self.request(
            trials_url
            or f"{self.host('extforcedecks')}/v2019q3/teams/{tenant_id}/tests/{test_id}/trials"
        )


def normalize_list(payload: Any) -> list[dict[str, Any]]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("items", "profiles", "tenants", "tests", "data", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []
