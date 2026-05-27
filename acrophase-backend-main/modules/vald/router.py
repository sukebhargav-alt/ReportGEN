from __future__ import annotations

from collections import OrderedDict
from datetime import date, datetime
from io import BytesIO
import logging
import re
from typing import Optional

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse, StreamingResponse

from modules.common.config import client
from modules.common.responses import error_response, success_response
from modules.vald.client import ValdApiClient
from modules.vald.repository import ValdRepository
from modules.vald.renderer import render_vald_joint_pdf
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
    assessment_date: Optional[str] = None,
    sport: Optional[str] = None,
):
    if assessment_date:
        try:
            date.fromisoformat(assessment_date)
        except ValueError:
            return JSONResponse(
                status_code=400,
                content=error_response(
                    message="Invalid assessment date",
                    errors=["assessment_date must use YYYY-MM-DD format"],
                ),
            )
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
        assessment_date=assessment_date,
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
        "context": {"assessment_date": assessment_date, "sport": sport},
        "dynamometer": {"tests": [], "joints": []},
        "forcedecks": {"tests": [], "joints": []},
    }

    for test in tests:
        section = "dynamometer" if test["device"] == "dynamo" else "forcedecks"
        metrics = metrics_by_test.get(test["vald_test_id"], [])
        selected_metrics = select_key_metrics(test.get("test_type") or "", metrics)
        if not selected_metrics:
            continue
        response[section]["tests"].append(
            {
                "vald_test_id": test["vald_test_id"],
                "test_type": test.get("test_type"),
                "test_date": test.get("test_date"),
                "metrics": selected_metrics,
                "available_metric_count": len(metrics),
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
    sport = str(data.get("sport") or "").strip() or "sport not provided"
    assessment_date = data.get("assessment_date") or "not provided"
    interpretations: dict[str, str] = {}

    for joint in joints:
        joint_name = str(joint.get("joint") or "").strip()
        tests = joint.get("tests") or []
        metric_lines = [
            format_metric_for_prompt(test.get("test_type", "Test"), metric)
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
Sport: {sport}
Assessment date: {assessment_date}
Joint/region: {joint_name}

Measured data:
{chr(10).join(metric_lines)}

Write a detailed joint-specific interpretation of 220-320 words relevant to the physical demands of {sport}, with these Markdown headings:
**Measurement Summary**
**Sport-Specific Meaning**
**Comparison Context**
**Practical Priorities**

Use only the supplied data. Describe observed left-right differences when shown.
Do not call a value significant, deficient, abnormal, risky, or injury-related without a supplied benchmark.
Do not diagnose injury or prescribe treatment. Frame actions as options for coach or practitioner review.
Green or red asymmetry screening labels use an operational 10% review threshold, not an age- or sport-specific VALD norm.
No numerical VALD Norms percentile was supplied by the API, so explicitly state that absolute values need VALD Hub norms or an approved benchmark for age-matched interpretation.
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


@router.post("/vald/final-pdf")
async def generate_vald_final_pdf(data: dict = Body(...)):
    buffer = BytesIO()
    await render_vald_joint_pdf(buffer, data)
    buffer.seek(0)
    athlete_name = re.sub(
        r"[^A-Za-z0-9_-]+", "_", str((data.get("athlete") or {}).get("name") or "athlete")
    ).strip("_")
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={athlete_name}_VALD_Joint_Report.pdf"
        },
    )


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
            "available_metric_count": sum(
                test.get("available_metric_count", len(test.get("metrics") or []))
                for test in joint_tests
            ),
            "last_test_date": next(
                (test.get("test_date") for test in joint_tests if test.get("test_date")),
                None,
            ),
        }
        for joint, joint_tests in grouped.items()
    ]


def select_key_metrics(test_type: str, metrics: list[dict], limit: int = 5) -> list[dict]:
    asymmetry = next(
        (
            metric
            for metric in metrics
            if "asymmetry" in str(metric.get("name") or "").lower()
        ),
        None,
    )
    average_only = [
        metric
        for metric in metrics
        if "avg " in str(metric.get("name") or "").lower()
        and not (
            test_type.lower().startswith("strength:")
            and "range of motion" in str(metric.get("name") or "").lower()
        )
    ]
    ranked = sorted(
        enumerate(average_only),
        key=lambda item: (-metric_priority(test_type, item[1].get("name") or ""), item[0]),
    )
    rows: OrderedDict[tuple[str, str | None], dict] = OrderedDict()
    for _, metric in ranked:
        name = str(metric.get("name") or "")
        side_match = re.search(r"\s*\((Right|Left)\)\s*$", name, flags=re.IGNORECASE)
        base_name = name[: side_match.start()].strip() if side_match else name
        key = (display_metric_name(base_name), metric.get("unit"))
        if key not in rows:
            rows[key] = {
                "name": key[0],
                "value": metric.get("value") if not side_match else None,
                "unit": metric.get("unit"),
                "status": "neutral",
                "status_label": "Measured",
                "reference_note": "VALD Norms percentile not available through this API response.",
            }
        if side_match:
            side = side_match.group(1).lower()
            rows[key][f"{side}_value"] = metric.get("value")
    selected = [
        row
        for row in list(rows.values())[:limit]
        if row.get("right_value") is not None and row.get("left_value") is not None
    ]
    for index, metric in enumerate(selected):
        asymmetry_value = bilateral_asymmetry(metric)
        if index == 0 and asymmetry is not None:
            asymmetry_value = abs(float(asymmetry["value"]))
        screened = add_metric_status({"name": "Asymmetry", "value": asymmetry_value})
        metric.update(
            {
                "asymmetry_value": asymmetry_value,
                "asymmetry_unit": "%",
                "direction": asymmetry_direction(metric),
                "status": screened.get("status"),
                "status_label": screened.get("status_label"),
                "reference_note": (
                    "VALD-reported asymmetry; operational <=10% screening band."
                    if index == 0 and asymmetry is not None
                    else "Calculated from displayed bilateral averages; operational <=10% screening band."
                ),
            }
        )
    return selected


def metric_priority(test_type: str, name: str) -> int:
    label = name.lower()
    if "asymmetry" in label:
        return 120
    if test_type.lower().startswith("strength:"):
        strength_priorities = (
            ("avg force", 115),
            ("avg rate of force development", 110),
            ("avg impulse", 105),
            ("avg time to peak force", 100),
            ("range of motion", 10),
        )
        return next((score for term, score in strength_priorities if term in label), 20)
    priorities = (
        ("avg range of motion", 110),
        ("avg force", 100),
        ("avg rate of force development", 90),
        ("avg impulse", 80),
        ("avg time to peak force", 70),
    )
    return next((score for term, score in priorities if term in label), 10)


def display_metric_name(name: str) -> str:
    return re.sub(r"\bAvg Range Of Motion\b", "Average ROM", name, flags=re.IGNORECASE).replace(
        "Avg ", "Average "
    )


def asymmetry_direction(metric: dict) -> str:
    right = metric.get("right_value")
    left = metric.get("left_value")
    if right is None or left is None:
        return "-"
    if float(right) == float(left):
        return "Equal"
    return "Towards Right" if float(right) > float(left) else "Towards Left"


def bilateral_asymmetry(metric: dict) -> float:
    right = abs(float(metric["right_value"]))
    left = abs(float(metric["left_value"]))
    larger = max(right, left)
    return round(abs(right - left) / larger * 100, 1) if larger else 0.0


def add_metric_status(metric: dict) -> dict:
    result = dict(metric)
    if "asymmetry" in str(metric.get("name") or "").lower():
        try:
            difference = abs(float(metric.get("value")))
        except (TypeError, ValueError):
            return result
        within_band = difference <= 10
        result.update(
            {
                "status": "green" if within_band else "red",
                "status_label": "Within screening band" if within_band else "Review asymmetry",
                "reference_note": "Operational asymmetry screening band: <=10%; not a VALD norm.",
            }
        )
    else:
        result.update(
            {
                "status": "neutral",
                "status_label": "Measured",
                "reference_note": "VALD Norms percentile not available through this API response.",
            }
        )
    return result


def format_metric_for_prompt(test_type: str, metric: dict) -> str:
    unit = metric.get("unit") or ""
    status = f" [{metric.get('status_label')}]" if metric.get("status_label") else ""
    if metric.get("right_value") is not None or metric.get("left_value") is not None:
        asymmetry = (
            f"; Asymmetry {metric.get('asymmetry_value')} {metric.get('asymmetry_unit')} "
            f"{metric.get('direction')}{status}"
            if metric.get("asymmetry_value") is not None
            else ""
        )
        return (
            f"{test_type}: {metric.get('name')} = Right {metric.get('right_value')} {unit}; "
            f"Left {metric.get('left_value')} {unit}{asymmetry}"
        ).strip()
    return (
        f"{test_type}: {metric.get('name')} = {metric.get('value')} {unit}{status}"
    ).strip()


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
