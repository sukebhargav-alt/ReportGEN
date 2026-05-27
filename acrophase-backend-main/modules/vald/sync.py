from __future__ import annotations

import asyncio
import re
import time
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from modules.vald.client import ValdApiClient, normalize_list
from modules.vald.repository import ValdRepository

MAX_RUN_SECONDS = 240
BATCH_DELAY_SECONDS = 0.5

HEALTHY_THRESHOLDS = {
    "CMJ": 60,
    "ABCMJ": 60,
    "SJ": 30,
    "DJ": 60,
    "HJ": 60,
    "IMTP": 30,
    "LAH": 12,
    "QSB": 20,
    "SQT": 30,
    "SEICR": 60,
    "STICR": 60,
    "STSTS": 30,
    "SHLDISOI": 30,
    "SHLDISOT": 30,
    "SHLDISOY": 30,
    "SJ_PSA": 30,
    "SLHAR": 30,
    "SLHJ": 60,
    "SLJ": 60,
    "SLSB": 12,
}
BILATERAL_TEST_TYPES = {"SLSB", "SHLDISOI", "SHLDISOT", "SHLDISOY"}
NOISE_RE = re.compile(r"(^weight$|analysed offset|recorded offset|offset$)", re.I)


class ValdSyncService:
    def __init__(self):
        self.api = ValdApiClient()
        self.repo = ValdRepository()
        self.started_at = time.monotonic()
        self.warnings: list[dict[str, str]] = []

    def has_time(self) -> bool:
        return time.monotonic() - self.started_at < MAX_RUN_SECONDS

    async def sync_all(self) -> dict[str, Any]:
        tenants = await self.api.tenants()
        if not tenants:
            return {"tenantCount": 0, "warnings": [{"message": "No tenants found"}]}

        tenant = tenants[0]
        tenant_id = pick(tenant, "tenantId", "id", "teamId")
        tenant_name = pick(tenant, "name", "tenantName", "teamName")
        if not tenant_id:
            return {"tenantCount": len(tenants), "warnings": [{"message": "Tenant missing id"}]}

        await self.repo.upsert(
            "vald_tenants",
            [{"tenant_id": tenant_id, "name": tenant_name}],
            on_conflict="tenant_id",
        )

        profile_count = await self.sync_profiles(tenant_id)
        dynamo = await self.sync_dynamo(tenant_id)
        forcedecks = await self.sync_forcedecks(tenant_id)

        return {
            "tenantCount": len(tenants),
            "profileCount": profile_count,
            "dynamo": dynamo,
            "forcedecks": forcedecks,
            "warnings": self.warnings,
        }

    async def sync_profiles(self, tenant_id: str) -> int:
        profiles = await self.api.profiles(tenant_id)
        rows = []
        for profile in profiles:
            vald_id = pick(profile, "profileId", "athleteId", "id")
            name = format_name(profile)
            if vald_id and name:
                rows.append({"vald_id": vald_id, "name": name, "is_active": True})
        await self.repo.upsert("vald_athletes", rows, on_conflict="vald_id")
        return len(rows)

    async def sync_dynamo(self, tenant_id: str) -> dict[str, Any]:
        modified_from = await self.repo.get_sync_state("dynamo")
        page = 1
        tests_upserted = 0
        metrics_upserted = 0
        latest_modified = modified_from
        errors = []

        while self.has_time():
            try:
                payload = await self.api.dynamo_tests(tenant_id, modified_from, page)
            except Exception as exc:
                errors.append({"page": page, "error": str(exc)})
                break

            tests = normalize_list(payload)
            if not tests:
                break

            test_rows = [self.dynamo_test_row(test) for test in tests if self.dynamo_test_row(test)]
            await self.repo.upsert("vald_tests", test_rows, on_conflict="vald_test_id")
            tests_upserted += len(test_rows)

            for test in tests:
                test_id = pick(test, "testId", "id")
                if not test_id:
                    continue
                latest_modified = max_iso(
                    latest_modified,
                    pick(test, "lastModifiedUTC", "lastModifiedUtc", "modifiedDateUtc"),
                )
                try:
                    detail = await self.api.dynamo_detail(tenant_id, test_id)
                    metrics = self.extract_dynamo_metrics(test, detail or {})
                    await self.repo.delete_metrics_for_tests([test_id])
                    metrics_upserted += await self.repo.insert_metrics(metrics)
                except Exception as exc:
                    warning = {"device": "dynamo", "testId": test_id, "error": str(exc)}
                    self.warnings.append(warning)
                    errors.append(warning)

            total_pages = int(pick(payload, "totalPages") or page)
            if page >= total_pages:
                break
            page += 1

        if latest_modified != modified_from:
            await self.repo.update_sync_state("dynamo", latest_modified)

        return {
            "testsUpserted": tests_upserted,
            "metricsUpserted": metrics_upserted,
            "healedCount": 0,
            "errors": errors,
        }

    async def sync_forcedecks(self, tenant_id: str) -> dict[str, Any]:
        today = datetime.now(UTC).date()
        date_from = today - timedelta(days=182)
        page = 1
        tests_upserted = 0
        metrics_upserted = 0
        errors = []
        candidate_tests = []

        while self.has_time():
            try:
                payload = await self.api.forcedecks_tests(
                    tenant_id, date_from.isoformat(), today.isoformat(), page
                )
            except Exception as exc:
                errors.append({"page": page, "error": str(exc)})
                break

            tests = normalize_list(payload)
            if not tests:
                break

            test_rows = [self.forcedecks_test_row(test) for test in tests if self.forcedecks_test_row(test)]
            await self.repo.upsert("vald_tests", test_rows, on_conflict="vald_test_id")
            tests_upserted += len(test_rows)
            candidate_tests.extend(tests)

            for test in tests:
                test_id = pick(test, "testId", "id")
                if not test_id:
                    continue
                try:
                    metrics = await self.extract_forcedecks_metrics(tenant_id, test)
                    if metrics and not only_noise(metrics):
                        await self.repo.delete_metrics_for_tests([test_id])
                        metrics_upserted += await self.repo.insert_metrics(metrics)
                except Exception as exc:
                    warning = {"device": "forcedecks", "testId": test_id, "error": str(exc)}
                    self.warnings.append(warning)
                    errors.append(warning)

            if len(tests) < 50:
                break
            page += 1

        healed_count, healed_metrics = await self.heal_forcedecks(tenant_id, candidate_tests)
        metrics_upserted += healed_metrics
        await self.repo.update_sync_state("forcedecks", datetime.now(UTC).isoformat())

        return {
            "testsUpserted": tests_upserted,
            "metricsUpserted": metrics_upserted,
            "healedCount": healed_count,
            "errors": errors,
        }

    def dynamo_test_row(self, test: dict[str, Any]) -> dict[str, Any] | None:
        test_id = pick(test, "testId", "id")
        athlete_id = pick(test, "profileId", "athleteId")
        if not test_id or not athlete_id:
            return None
        return {
            "vald_test_id": test_id,
            "athlete_vald_id": athlete_id,
            "device": "dynamo",
            "test_type": dynamo_test_type(test),
            "test_date": pick(test, "recordedUTC", "recordedUtc", "testDateUtc", "startTimeUTC"),
            "raw_data": test,
        }

    def forcedecks_test_row(self, test: dict[str, Any]) -> dict[str, Any] | None:
        test_id = pick(test, "testId", "id")
        athlete_id = pick(test, "profileId", "athleteId")
        if not test_id or not athlete_id:
            return None
        return {
            "vald_test_id": test_id,
            "athlete_vald_id": athlete_id,
            "device": "forcedecks",
            "test_type": pick(test, "testType", "type", "testName"),
            "test_date": pick(test, "recordedUTC", "recordedUtc", "recordedDateUtc", "testDateUtc"),
            "raw_data": test,
        }

    def extract_dynamo_metrics(
        self, list_test: dict[str, Any], detail: dict[str, Any]
    ) -> list[dict[str, Any]]:
        test_id = pick(detail, "testId", "id") or pick(list_test, "testId", "id")
        movement = split_words(pick(detail, "movement") or pick(list_test, "movement") or "")
        side = normalize_side(pick(detail, "laterality") or pick(list_test, "laterality"))
        metrics = []

        reps = detail.get("reps") or detail.get("Reps") or []
        if isinstance(reps, list):
            for idx, rep in enumerate(reps, start=1):
                for key, value in rep.items():
                    if should_skip_dynamo_key(key) or not is_number(value):
                        continue
                    metric_name = f"{movement + ' ' if movement else ''}{split_words(key)}"
                    if side:
                        metric_name += f" ({side})"
                    metric_name += f" [Rep {pick(rep, 'repNo', 'repNumber') or idx}]"
                    metrics.append(metric_row(test_id, metric_name, value, pick(rep, "unit", "units")))

        for key, value in detail.items():
            if key in {"page", "totalPages", "durationSeconds"}:
                continue
            if should_skip_dynamo_key(key) or not is_number(value):
                continue
            metric_name = split_words(key)
            if side:
                metric_name += f" ({side})"
            metrics.append(metric_row(test_id, metric_name, value, None))

        return metrics

    async def extract_forcedecks_metrics(
        self, tenant_id: str, test: dict[str, Any]
    ) -> list[dict[str, Any]]:
        test_id = pick(test, "testId", "id")
        links = test.get("links") if isinstance(test.get("links"), dict) else {}
        trials_url = links.get("Trials") or links.get("trials")
        payload = await self.api.forcedecks_trials(tenant_id, test_id, trials_url)
        trials = normalize_list(payload)
        metrics = []

        for trial in trials:
            trial_side = normalize_side(pick(trial, "limb", "side", "laterality", "leg", "testSide", "position"))
            results = trial.get("results") or trial.get("Results") or []
            if isinstance(results, dict):
                results = results.values()
            for result in results:
                if not isinstance(result, dict):
                    continue
                definition = result.get("definition") or {}
                metric_name = (
                    pick(definition, "name")
                    or pick(result, "name", "metricName", "label")
                )
                value = pick(result, "value")
                if not metric_name or not is_number(value):
                    continue
                side = normalize_side(
                    pick(result, "limb", "side", "laterality", "leg", "testSide", "position")
                ) or trial_side
                if side:
                    metric_name = f"{metric_name} ({side})"
                unit = pick(definition, "unit") or pick(result, "unit")
                metrics.append(metric_row(test_id, metric_name, value, unit))

        if only_noise(metrics):
            return []
        return metrics

    async def heal_forcedecks(
        self, tenant_id: str, tests: list[dict[str, Any]]
    ) -> tuple[int, int]:
        heal_targets = []
        for test in tests:
            test_id = pick(test, "testId", "id")
            if test_id:
                heal_targets.append(test)

        healed_count = 0
        metrics_inserted = 0
        for start in range(0, len(heal_targets), 10):
            batch = heal_targets[start : start + 10]
            for test in batch:
                test_id = pick(test, "testId", "id")
                current = await self.repo.fetch_metrics_for_tests([test_id])
                metrics = current.get(test_id, [])
                if not needs_healing(pick(test, "testType", "type", "testName"), metrics):
                    continue
                fresh = await self.extract_forcedecks_metrics(tenant_id, test)
                if fresh:
                    await self.repo.delete_metrics_for_tests([test_id])
                    metrics_inserted += await self.repo.insert_metrics(fresh)
                    healed_count += 1
            await asyncio.sleep(BATCH_DELAY_SECONDS)
        return healed_count, metrics_inserted


def pick(obj: Any, *keys: str) -> Any:
    if not isinstance(obj, dict):
        return None
    lower_map = {str(k).lower(): v for k, v in obj.items()}
    for key in keys:
        if key in obj:
            return obj[key]
        value = lower_map.get(key.lower())
        if value is not None:
            return value
    return None


def format_name(profile: dict[str, Any]) -> str:
    direct = pick(profile, "name", "fullName", "displayName")
    if direct:
        return str(direct).strip()
    first = pick(profile, "firstName", "givenName") or ""
    last = pick(profile, "lastName", "familyName", "surname") or ""
    return f"{first} {last}".strip()


def split_words(value: Any) -> str:
    text = str(value or "").replace("_", " ").replace("-", " ")
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_side(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"right", "r", "rt"}:
        return "Right"
    if text in {"left", "l", "lt"}:
        return "Left"
    return None


def dynamo_test_type(test: dict[str, Any]) -> str:
    category = str(pick(test, "testCategory") or "")
    prefix = ""
    if category.lower() == "strength":
        prefix = "Strength: "
    elif category.lower() in {"rangeofmotion", "range of motion"}:
        prefix = "ROM: "

    body = split_words(pick(test, "bodyRegion") or "")
    movement = split_words(pick(test, "movement") or "")
    side = normalize_side(pick(test, "laterality"))
    name = " ".join(part for part in [body, movement] if part).strip()
    if side:
        name = f"{name} - {side}" if name else side
    return f"{prefix}{name}".strip() or pick(test, "testType", "type") or "Dynamo Test"


def should_skip_dynamo_key(key: str) -> bool:
    lower = key.lower()
    return "id" in lower or lower in {"repno", "repnumber"}


def is_number(value: Any) -> bool:
    if isinstance(value, bool) or value is None:
        return False
    try:
        Decimal(str(value))
        return True
    except (InvalidOperation, ValueError):
        return False


def metric_row(test_id: str, name: str, value: Any, unit: Any) -> dict[str, Any]:
    return {
        "test_vald_id": test_id,
        "metric_name": name,
        "metric_value": float(value),
        "unit": unit,
    }


def max_iso(current: str, candidate: Any) -> str:
    if not candidate:
        return current
    return max(str(current), str(candidate))


def only_noise(metrics: list[dict[str, Any]]) -> bool:
    return bool(metrics) and all(NOISE_RE.search(m["metric_name"]) for m in metrics)


def real_metric_count(metrics: list[dict[str, Any]]) -> int:
    return sum(1 for metric in metrics if not NOISE_RE.search(metric["name"]))


def needs_healing(test_type: Any, metrics: list[dict[str, Any]]) -> bool:
    type_key = str(test_type or "").upper()
    if not metrics:
        return True
    threshold = HEALTHY_THRESHOLDS.get(type_key, 8)
    if real_metric_count(metrics) < threshold:
        return True
    if type_key in BILATERAL_TEST_TYPES:
        side_counts = Counter(
            side
            for metric in metrics
            for side in ["Right", "Left"]
            if f"({side})" in metric["name"]
        )
        if not side_counts or len(side_counts) == 1:
            return True
    return False
