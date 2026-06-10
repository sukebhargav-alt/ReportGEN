from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

import httpx

from modules.vald.config import get_vald_settings


class ValdRepository:
    def __init__(self):
        settings = get_vald_settings()
        self.supabase_url = settings.supabase_url
        self.service_role_key = settings.supabase_service_role_key

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    async def request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, str] | None = None,
        json: Any = None,
        prefer: str | None = None,
    ) -> Any:
        headers = self.headers
        if prefer:
            headers["Prefer"] = prefer

        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.request(
                method,
                f"{self.supabase_url}/rest/v1/{table}",
                params=params,
                json=json,
                headers=headers,
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise httpx.HTTPStatusError(
                    f"{exc} - {response.text}",
                    request=exc.request,
                    response=exc.response,
                ) from exc

        if not response.content:
            return None
        return response.json()

    async def upsert(
        self,
        table: str,
        rows: list[dict[str, Any]],
        *,
        on_conflict: str,
        returning: bool = False,
    ) -> list[dict[str, Any]]:
        if not rows:
            return []

        result = await self.request(
            "POST",
            table,
            params={"on_conflict": on_conflict},
            json=rows,
            prefer=(
                "resolution=merge-duplicates,return=representation"
                if returning
                else "resolution=merge-duplicates"
            ),
        )
        return result or []

    async def delete_metrics_for_tests(self, test_ids: list[str]) -> None:
        if not test_ids:
            return
        quoted = ",".join(f'"{test_id}"' for test_id in test_ids)
        await self.request(
            "DELETE",
            "vald_metrics",
            params={"test_vald_id": f"in.({quoted})"},
        )

    async def insert_metrics(self, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0

        batch_size = 500
        inserted = 0
        for start in range(0, len(rows), batch_size):
            batch = rows[start : start + batch_size]
            await self.request("POST", "vald_metrics", json=batch)
            inserted += len(batch)
        return inserted

    async def get_sync_state(self, device_name: str) -> str:
        result = await self.request(
            "GET",
            "vald_sync_state",
            params={
                "select": "last_synced_at",
                "device_name": f"eq.{device_name}",
                "limit": "1",
            },
        )
        if not result:
            await self.upsert(
                "vald_sync_state",
                [{"device_name": device_name}],
                on_conflict="device_name",
            )
            return "2020-01-01T00:00:00Z"
        return result[0]["last_synced_at"]

    async def update_sync_state(self, device_name: str, last_synced_at: str) -> None:
        await self.upsert(
            "vald_sync_state",
            [
                {
                    "device_name": device_name,
                    "last_synced_at": last_synced_at,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            ],
            on_conflict="device_name",
        )

    async def lookup_athletes_by_name(self, name: str) -> list[dict[str, Any]]:
        safe_name = name.replace("*", "").replace('"', '\\"')
        return await self.request(
            "GET",
            "vald_athletes",
            params={
                "select": "vald_id,name",
                "name": f"ilike.%{safe_name}%",
                "is_active": "eq.true",
                "order": "name.asc",
                "limit": "20",
            },
        ) or []

    async def fetch_athlete_by_id(self, vald_id: str) -> dict[str, Any] | None:
        rows = await self.request(
            "GET",
            "vald_athletes",
            params={
                "select": "vald_id,name",
                "vald_id": f"eq.{vald_id}",
                "is_active": "eq.true",
                "limit": "1",
            },
        ) or []
        return rows[0] if rows else None

    async def fetch_assessment_dates(
        self, vald_id: str, *, device: str | None = None
    ) -> list[str]:
        params = {
            "select": "test_date",
            "athlete_vald_id": f"eq.{vald_id}",
            "test_date": "not.is.null",
            "order": "test_date.desc",
        }
        if device:
            params["device"] = f"eq.{device}"
        rows = await self.request("GET", "vald_tests", params=params) or []
        return list(
            dict.fromkeys(
                str(row["test_date"])[:10]
                for row in rows
                if row.get("test_date")
            )
        )

    async def fetch_tests_for_athlete(
        self,
        vald_id: str,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        test_type: str | None = None,
        device: str | None = None,
        assessment_date: str | None = None,
    ) -> list[dict[str, Any]]:
        params = {
            "select": "vald_test_id,device,test_type,test_date",
            "athlete_vald_id": f"eq.{vald_id}",
            "order": "test_date.desc.nullslast",
        }
        date_filters: list[str] = []
        if assessment_date:
            date_filters.extend(
                [
                    f"test_date.gte.{assessment_date}T00:00:00Z",
                    f"test_date.lte.{assessment_date}T23:59:59.999999Z",
                ]
            )
        else:
            if date_from:
                date_filters.append(f"test_date.gte.{date_from}")
            if date_to:
                date_filters.append(f"test_date.lte.{date_to}")
        if date_filters:
            params["and"] = f"({','.join(date_filters)})"
        if test_type:
            params["test_type"] = f"eq.{test_type}"
        if device:
            params["device"] = f"eq.{device}"

        return await self.request("GET", "vald_tests", params=params) or []

    async def fetch_metrics_for_tests(
        self, test_ids: list[str]
    ) -> dict[str, list[dict[str, Any]]]:
        if not test_ids:
            return {}

        quoted = ",".join(f'"{test_id}"' for test_id in test_ids)
        rows = await self.request(
            "GET",
            "vald_metrics",
            params={
                "select": "test_vald_id,metric_name,metric_value,unit",
                "test_vald_id": f"in.({quoted})",
                "order": "created_at.asc",
            },
        ) or []

        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            grouped[row["test_vald_id"]].append(
                {
                    "name": row["metric_name"],
                    "value": row["metric_value"],
                    "unit": row.get("unit"),
                }
            )
        return grouped
