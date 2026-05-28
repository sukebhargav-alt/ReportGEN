from __future__ import annotations

import asyncio
import os
import re
from copy import deepcopy
from collections import Counter, defaultdict
from typing import Any

import markdown
from jinja2 import Environment, FileSystemLoader, select_autoescape
from playwright.sync_api import sync_playwright


def format_metric_value(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value or "-")
    return f"{number:,.2f}".rstrip("0").rstrip(".")


def format_report_date(value: Any) -> str:
    if not value:
        return "-"
    text = str(value)[:10]
    try:
        from datetime import date

        parsed = date.fromisoformat(text)
    except (TypeError, ValueError):
        return text
    return parsed.strftime("%d %b %Y").upper()


def _render_pdf(buffer, data: dict[str, Any]) -> None:
    payload = deepcopy(data)
    athlete_name = str((payload.get("athlete") or {}).get("name") or "Athlete")
    payload["initials"] = "".join(
        word[0].upper() for word in athlete_name.split()[:2] if word
    ) or "AT"
    payload["interpretations_html"] = {
        joint: markdown.markdown(text)
        for joint, text in (payload.get("interpretations") or {}).items()
    }
    payload["concern_movements"] = [
        {
            "joint": joint.get("joint"),
            "test_type": test.get("test_type"),
            "metric": metric.get("name"),
            "asymmetry_value": metric.get("asymmetry_value"),
            "asymmetry_unit": metric.get("asymmetry_unit") or "%",
            "direction": metric.get("direction"),
        }
        for joint in payload.get("joints") or []
        for test in joint.get("tests") or []
        for metric in test.get("metrics") or []
        if metric.get("status") == "red"
    ]
    concern_counts = Counter(item["joint"] for item in payload["concern_movements"])
    concern_examples: dict[str, list[str]] = defaultdict(list)
    for item in payload["concern_movements"]:
        joint = item.get("joint")
        metric = item.get("metric")
        if joint and metric and len(concern_examples[joint]) < 2:
            concern_examples[joint].append(str(metric))
    payload["concern_summary"] = [
        {
            "joint": joint,
            "count": count,
            "examples": concern_examples.get(joint, []),
        }
        for joint, count in concern_counts.most_common()
    ]
    enrich_visual_summary(payload)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(base_dir, "templates")
    env = Environment(
        loader=FileSystemLoader(templates_dir),
        autoescape=select_autoescape(["html", "xml"]),
    )
    env.filters["metric_value"] = format_metric_value
    env.filters["report_date"] = format_report_date
    html = env.get_template("joint_report.html").render(data=payload)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="load")
        buffer.write(
            page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "24px", "bottom": "24px", "left": "24px", "right": "24px"},
                display_header_footer=False,
            )
        )
        browser.close()


async def render_vald_joint_pdf(buffer, data: dict[str, Any]) -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _render_pdf, buffer, data)


def enrich_visual_summary(payload: dict[str, Any]) -> None:
    metrics = [
        metric
        for joint in payload.get("joints") or []
        for test in joint.get("tests") or []
        for metric in test.get("metrics") or []
    ]
    bilateral_metrics = [
        metric
        for metric in metrics
        if metric.get("right_value") is not None and metric.get("left_value") is not None
    ]
    red_count = sum(1 for metric in metrics if metric.get("status") == "red")
    total_count = len(metrics) or 1
    bilateral_count = len(bilateral_metrics) or 1
    payload["visual_summary"] = {
        "performance_score": round((1 - red_count / total_count) * 100),
        "risk_score": round(red_count / bilateral_count * 100),
        "total_metrics": len(metrics),
        "red_count": red_count,
        "risk_label": severity_label(red_count / bilateral_count * 100),
        "readiness_status": readiness_status(red_count / total_count * 100),
        "return_to_sport_status": return_to_sport_status(red_count / bilateral_count * 100),
    }
    payload["insight_sections"] = {
        joint: parse_interpretation_sections(text)
        for joint, text in (payload.get("interpretations") or {}).items()
    }
    for joint in payload.get("joints") or []:
        joint_metrics = [
            metric
            for test in joint.get("tests") or []
            for metric in test.get("metrics") or []
        ]
        red_metrics = [metric for metric in joint_metrics if metric.get("status") == "red"]
        max_metric = max(
            joint_metrics,
            key=lambda metric: float(metric.get("asymmetry_value") or 0),
            default={},
        )
        max_asymmetry = float(max_metric.get("asymmetry_value") or 0)
        joint["visual"] = {
            "asymmetry_count": len(red_metrics),
            "severity": severity_label(max_asymmetry),
            "severity_class": severity_class(max_asymmetry),
            "score": round((1 - len(red_metrics) / (len(joint_metrics) or 1)) * 100),
            "key_concern": max_metric.get("name") or "No major concern",
            "key_asymmetry": max_asymmetry,
            "impact": impact_summary(joint.get("joint"), max_metric),
        }
        for metric in joint_metrics:
            enrich_metric_visual(metric)
        joint["display_groups"] = build_display_groups(joint, payload.get("report_type") or "")


def enrich_metric_visual(metric: dict[str, Any]) -> None:
    asymmetry = float(metric.get("asymmetry_value") or 0)
    metric["visual"] = {
        "severity_class": severity_class(asymmetry),
        "severity_label": severity_label(asymmetry),
        "asymmetry_width": min(100, round(asymmetry * 3)),
        "card_range_min": metric_range_min(metric),
        "card_range_mid": metric_range_mid(metric),
        "card_range_max": metric_range_max(metric),
    }
    right = metric.get("right_value")
    left = metric.get("left_value")
    if right is None or left is None:
        return
    try:
        right_value = abs(float(right))
        left_value = abs(float(left))
    except (TypeError, ValueError):
        return
    total = right_value + left_value
    if not total:
        return
    metric["visual"].update(
        {
            "right_pct": round(right_value / total * 100, 1),
            "left_pct": round(left_value / total * 100, 1),
        }
    )


def metric_range_min(metric: dict[str, Any]) -> str:
    values = metric_numeric_values(metric)
    if not values:
        return "-"
    return format_metric_value(min(values) * 0.82)


def metric_range_mid(metric: dict[str, Any]) -> str:
    values = metric_numeric_values(metric)
    if not values:
        return "-"
    return format_metric_value(sum(values) / len(values))


def metric_range_max(metric: dict[str, Any]) -> str:
    values = metric_numeric_values(metric)
    if not values:
        return "-"
    return format_metric_value(max(values) * 1.18)


def metric_numeric_values(metric: dict[str, Any]) -> list[float]:
    values = []
    for key in ("right_value", "left_value", "value"):
        try:
            if metric.get(key) is not None:
                values.append(abs(float(metric.get(key))))
        except (TypeError, ValueError):
            continue
    return values


def build_display_groups(joint: dict[str, Any], report_type: str) -> list[dict[str, Any]]:
    metrics = [
        {**metric, "_test_type": test.get("test_type")}
        for test in joint.get("tests") or []
        for metric in test.get("metrics") or []
    ]
    if not metrics:
        return []

    if "force" in report_type.lower():
        specs = [
            ("Jump & Reactive", ("jump", "rsi", "contact", "takeoff")),
            ("Force Production", ("force", "rfd", "stiffness", "impulse")),
            ("Balance & Control", ("cop", "velocity", "excursion", "ellipse", "balance")),
        ]
    else:
        specs = [
            ("ROM", ("rom", "°", "deg")),
            ("Strength", ("force", "rate of force", "impulse", "rfd")),
        ]

    used: set[int] = set()
    groups: list[dict[str, Any]] = []
    for label, patterns in specs:
        selected = [
            metric
            for metric in metrics
            if any(
                pattern in f"{metric.get('name', '')} {metric.get('_test_type', '')}".lower()
                for pattern in patterns
            )
        ]
        selected = select_readable_metrics(selected, limit=3)
        if selected:
            for metric in selected:
                used.add(id(metric))
            groups.append({"name": label, "metrics": selected})

    remaining = [metric for metric in metrics if id(metric) not in used]
    if remaining and len(groups) < 2:
        groups.append({"name": "Key Metrics", "metrics": select_readable_metrics(remaining, limit=3)})
    return groups[:3]


def select_readable_metrics(metrics: list[dict[str, Any]], limit: int = 4) -> list[dict[str, Any]]:
    ranked = sorted(
        metrics,
        key=lambda metric: (
            metric.get("status") != "red",
            -float(metric.get("asymmetry_value") or 0),
            str(metric.get("name") or ""),
        ),
    )
    return ranked[:limit]


def severity_label(value: float) -> str:
    if value >= 20:
        return "High"
    if value > 10:
        return "Moderate"
    return "Controlled"


def severity_class(value: float) -> str:
    if value >= 20:
        return "high"
    if value > 10:
        return "moderate"
    return "controlled"


def readiness_status(value: float) -> str:
    if value >= 26:
        return "Needs targeted review"
    if value > 12:
        return "Proceed with monitoring"
    return "Ready with maintenance"


def return_to_sport_status(value: float) -> str:
    if value >= 26:
        return "Modified exposure advised"
    if value > 12:
        return "Monitor asymmetry load"
    return "Full training compatible"


def impact_summary(joint_name: str | None, metric: dict[str, Any]) -> str:
    joint = (joint_name or "This region").lower()
    metric_name = str(metric.get("name") or "movement quality").lower()
    if "hip" in joint:
        return "Lunging, deceleration, court coverage and first-step power."
    if "knee" in joint:
        return "Braking control, repeated jumping and change-of-direction tolerance."
    if "ankle" in joint:
        return "Push-off efficiency, landing control and repeated court transitions."
    if "shoulder" in joint:
        return "Overhead control, racket acceleration and repeat-stroke robustness."
    if "force" in metric_name:
        return "Force expression and repeatable bilateral output."
    return "Movement efficiency and sport-specific repeatability."


def parse_interpretation_sections(text: str) -> list[dict[str, str]]:
    sections: list[dict[str, str]] = []
    current_title: str | None = None
    current_lines: list[str] = []
    for line in (text or "").splitlines():
        clean = line.strip()
        if not clean:
            continue
        match = re.match(r"^\*\*(.+?)\*\*$", clean)
        if match:
            if current_title:
                sections.append(
                    {"title": current_title, "body": " ".join(current_lines).strip()}
                )
            current_title = match.group(1)
            current_lines = []
        else:
            current_lines.append(clean)
    if current_title:
        sections.append({"title": current_title, "body": " ".join(current_lines).strip()})
    return sections
