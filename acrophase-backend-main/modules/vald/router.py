from __future__ import annotations

from collections import OrderedDict
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from modules.common.responses import error_response, success_response
from modules.vald.repository import ValdRepository
from modules.vald.sync import ValdSyncService

router = APIRouter()


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
    tests = await repo.fetch_tests_for_athlete(
        athlete["vald_id"],
        date_from=date_from,
        date_to=date_to,
        test_type=test_type,
    )
    if latest_only:
        tests = most_recent_per_test_type(tests)

    metrics_by_test = await repo.fetch_metrics_for_tests(
        [test["vald_test_id"] for test in tests]
    )

    response = {
        "athlete": athlete,
        "dynamometer": {"tests": []},
        "forcedecks": {"tests": []},
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

    return response


def most_recent_per_test_type(tests: list[dict]) -> list[dict]:
    selected = OrderedDict()
    for test in tests:
        key = (test.get("device"), test.get("test_type"))
        if key not in selected:
            selected[key] = test
    return list(selected.values())
