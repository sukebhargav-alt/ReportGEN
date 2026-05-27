from __future__ import annotations

from collections import OrderedDict
from datetime import date, datetime
import logging
import re
from typing import Optional

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from modules.common.config import client
from modules.common.responses import error_response, success_response
from modules.vald.client import ValdApiClient
from modules.vald.repository import ValdRepository
from modules.vald.sync import ValdSyncService, pick

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/vald/sync")
async def sync_vald_data():
    try:
        result = await ValdSyncService().sync_all()
        return success_response(data=result, message="VALD sync completed")
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content=error_response(message="VALD sync failed", errors=[str(exc)]),
        )


@router.get("/athlete-report")
async def athlete_report(
    name: str = Query(..., min_length=1),
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
    test_type: Optional[str] = None,
    latest_only: bool = False,
    device: Optional[str] = None,
):
    repo = ValdRepository()
    matches = await repo.lookup_athletes_by_name(name.strip())
    exact_matches = [
        athlete
        for athlete in matches
        if athlete.get("name", "").strip().lower() == name.strip().lower()
    ]

    if not exact_matches:
        if matches:
            return JSONResponse(
                status_code=409,
                content={
                    "message": "Multiple or partial athlete matches found",
                    "candidates": matches,
                },
            )
        return JSONResponse(
            status_code=404,
            content=error_response(
                message="Athlete not found",
                errors=[f"No active VALD athlete found for name '{name}'"],
            ),
        )

    if len(exact_matches) > 1:
        return JSONResponse(
            status_code=409,
            content={
                "message": "Multiple athlete matches found",
                "candidates": exact_matches,
            },
        )

    athlete = exact_matches[0]
    device_key = {"dynamometer": "dynamo", "forcedecks": "forcedecks"}.get(
        device or "", device
    )
    tests = await repo.fetch_tests_for_athlete(
        athlete["vald_id"],
        date_from=date_from,
        date_to=date_to,
        test_type=test_type,
        device=device_key,
    )
    if latest_only:
        tests = most_recent_per_test_type(tests)

    metrics_by_test = await repo.fetch_metrics_for_tests(
        [test["vald_test_id"] for test in tests]
    )
    try:
        api = ValdApiClient()
        tenants = await api.tenants()
        tenant_id = pick(tenants[0], "tenantId", "id", "teamId") if tenants else None
        if tenant_id:
            service = ValdSyncService()
            service.repo = repo
            repaired = await service.repair_empty_dynamo_metrics(
                tenant_id, tests, metrics_by_test
            )
            if repaired:
                metrics_by_test = await repo.fetch_metrics_for_tests(
                    [test["vald_test_id"] for test in tests]
                )
            profiles = await api.profiles(tenant_id, [athlete["vald_id"]])
            profile = next(
                (
                    item
                    for item in profiles
                    if pick(item, "profileId", "athleteId", "id") == athlete["vald_id"]
                ),
                None,
            )
            if profile:
                athlete = enriched_athlete(athlete, profile)
    except Exception as exc:
        logger.warning("VALD live enrichment failed for %s: %s", athlete["vald_id"], exc)

    response = {
        "athlete": athlete,
        "dynamometer": {"tests": [], "joints": []},
        "forcedecks": {"tests": [], "joints": []},
    }

    for test in tests:
        section = "dynamometer" if test["device"] == "dynamo" else "forcedecks"
        response[section]["tests"].append(
            {
                "vald_test_id": test["vald_test_id"],
                "test_type": test.get("test_type"),
                "test_date": test.get("test_date"),
                "metrics": metrics_by_test.get(test["vald_test_id"], []),
            }
        )

    for section in ("dynamometer", "forcedecks"):
        response[section]["joints"] = group_tests_by_joint(response[section]["tests"])

    return response


@router.post("/vald/joint-interpretations")
async def generate_joint_interpretations(data: dict = Body(...)):
    athlete = data.get("athlete") or {}
    joints = data.get("joints") or []
    report_type = data.get("report_type") or "VALD"
    interpretations: dict[str, str] = {}

    for joint in joints:
        joint_name = str(joint.get("joint") or "").strip()
        tests = joint.get("tests") or []
        metric_lines = [
            f"{test.get('test_type', 'Test')}: {metric.get('name')} = {metric.get('value')} {metric.get('unit') or ''}".strip()
            for test in tests
            for metric in (test.get("metrics") or [])
        ][:80]
        if not joint_name or not metric_lines:
            continue

        prompt = f"""
You are a sports performance scientist interpreting VALD testing data.

Athlete: {athlete.get("name", "Athlete")}
Age: {athlete.get("age_years") or "not available"}
Height: {athlete.get("height_cm") or "not available"} cm
Weight: {athlete.get("weight_kg") or "not available"} kg
Report system: {report_type}
Joint/region: {joint_name}

Measured data:
{chr(10).join(metric_lines)}

Write a concise joint-specific interpretation with these Markdown headings:
**Finding**
**Performance Implication**
**Action**

Use only the supplied data. Describe observed left-right differences when shown.
Do not call a value significant, deficient, abnormal, risky, or injury-related without a supplied benchmark.
Do not diagnose injury or prescribe treatment. Frame actions as options for coach or practitioner review.
If context or reference ranges are absent, say so briefly.
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You write technically careful, concise athlete performance interpretations.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        interpretations[joint_name] = constrain_interpretation_language(
            response.choices[0].message.content or ""
        )

    return {"interpretations": interpretations}


def most_recent_per_test_type(tests: list[dict]) -> list[dict]:
    selected = OrderedDict()
    for test in tests:
        key = (test.get("device"), test.get("test_type"))
        if key not in selected:
            selected[key] = test
    return list(selected.values())


def enriched_athlete(athlete: dict, profile: dict) -> dict:
    date_of_birth = pick(profile, "dateOfBirth", "date_of_birth")
    return {
        **athlete,
        "date_of_birth": date_of_birth,
        "age_years": calculate_age(date_of_birth),
        "height_cm": pick(profile, "heightCm", "height", "height_cm"),
        "weight_kg": pick(profile, "weightKg", "weight", "weight_kg"),
        "demographics_note": (
            "The VALD External Profiles API supplies date of birth for age calculation; "
            "height and weight are not returned by its current profile retrieval response."
        ),
    }


def calculate_age(date_of_birth: str | None) -> int | None:
    if not date_of_birth:
        return None
    try:
        born = datetime.fromisoformat(date_of_birth.replace("Z", "+00:00")).date()
    except ValueError:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def group_tests_by_joint(tests: list[dict]) -> list[dict]:
    grouped: OrderedDict[str, list[dict]] = OrderedDict()
    for test in tests:
        joint = joint_from_test_type(test.get("test_type") or "")
        grouped.setdefault(joint, []).append(test)
    return [
        {
            "joint": joint,
            "tests": joint_tests,
            "metric_count": sum(len(test.get("metrics") or []) for test in joint_tests),
            "last_test_date": next(
                (test.get("test_date") for test in joint_tests if test.get("test_date")),
                None,
            ),
        }
        for joint, joint_tests in grouped.items()
    ]


def joint_from_test_type(test_type: str) -> str:
    name = re.sub(r"^(ROM|Strength):\s*", "", test_type, flags=re.IGNORECASE)
    normalized = name.lower()
    for joint in (
        "Shoulder",
        "Elbow",
        "Wrist",
        "Hand",
        "Trunk",
        "Hip",
        "Knee",
        "Ankle",
        "Foot",
    ):
        if joint.lower() in normalized:
            return joint
    if any(term in normalized for term in ("jump", "squat", "countermovement")):
        return "Lower Body"
    return "Whole Body"


def constrain_interpretation_language(content: str) -> str:
    replacements = (
        (r"\bclinically significant\b", "observed"),
        (r"\binsignificant\b", "observed"),
        (r"\bsignificant\b", "observed"),
        (r"\babnormal\b", "observed"),
        (r"\bdeficien(?:t|cy)\b", "difference"),
        (r"\bdeficit\b", "difference"),
        (r"\bdeficits\b", "differences"),
        (
            r"\b(?:elevated |increased |potential )?risk of (?:an? )?(?:overuse )?injur(?:y|ies)\b",
            "consideration for qualified practitioner review",
        ),
        (r"\binjuries\b", "clinical concerns"),
        (r"\binjury\b", "clinical concern"),
    )
    safe_content = content
    for pattern, replacement in replacements:
        safe_content = re.sub(pattern, replacement, safe_content, flags=re.IGNORECASE)
    safe_content = re.sub(r"\ba observed\b", "an observed", safe_content, flags=re.IGNORECASE)
    return re.sub(
        r"(?:may |could |can )?(?:increase|elevate|heighten) (?:the )?consideration for qualified practitioner review",
        "warrants qualified practitioner review",
        safe_content,
        flags=re.IGNORECASE,
    )
