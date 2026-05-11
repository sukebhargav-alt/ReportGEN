"""
Prompt builder for CPET comparison (baseline vs follow-up) interpretations.

Each category prompt asks the model to produce structured JSON with per-metric
what/why/how entries, plus a short free-text system-level summary.
"""

from typing import Any


def build_comparison_prompt(category: str, profile: dict, metrics: list[dict]) -> str:
    """
    Build a prompt for a single physiological category.

    `metrics` is a list of dicts with keys:
        label, unit, baseline, followUp, delta, deltaPercent, improvement
    """

    CATEGORY_META = {
        "overall": {
            "name": "Overall Progress",
            "variables": "All key physiological metrics",
            "focus": (
                "overall performance trends, holistic fitness adaptations, and primary takeaways"
            ),
        },
        "cardiovascular": {
            "name": "Cardiovascular System",
            "variables": "HR Max, HR at VT1, HR at VT2, O₂ Pulse, HR Reserve, VO₂ Max (absolute & relative)",
            "focus": (
                "cardiac output efficiency, stroke volume, heart-rate-based thresholds, aerobic power"
            ),
        },
        "ventilation": {
            "name": "Ventilation System",
            "variables": "VE Max",
            "focus": (
                "breathing efficiency, peak ventilation"
            ),
        },
        "perfusion": {
            "name": "Ventilatory Perfusion",
            "variables": "VE/VCO₂ (min), VE/VO₂ (min), PetO₂ at VT1",
            "focus": (
                "gas exchange efficiency, ventilatory equivalents, CO₂ and O₂ clearance"
            ),
        },
        "metabolic": {
            "name": "Metabolic System",
            "variables": "Max METs, Energy Expenditure, RQ at VT1, Peak RQ, Peak Speed, Test Duration, VT1 Time, VT2 Time",
            "focus": (
                "energy system utilisation, substrate selection, metabolic flexibility, endurance capacity"
            ),
        },
    }

    meta = CATEGORY_META.get(category, {
        "name": category.title(),
        "variables": "all metrics in this system",
        "focus": "overall physiological performance",
    })

    # Build a readable metric snapshot for the prompt
    metric_lines = []
    for m in metrics:
        b = m.get("baseline")
        f = m.get("followUp")
        dp = m.get("deltaPercent")
        impr = m.get("improvement", "neutral")
        label = m.get("label", "")
        unit = m.get("unit", "")

        if b is None or f is None:
            metric_lines.append(f"- {label}: no data available in one or both tests")
        else:
            direction = "↑" if impr == "better" else ("↓" if impr == "worse" else "→")
            pct_str = f" ({dp:+.1f}%)" if dp is not None else ""
            metric_lines.append(
                f"- {label}: {b} → {f} {unit} {direction}{pct_str} [{impr}]"
            )

    metrics_block = "\n".join(metric_lines) if metric_lines else "- No metrics available"

    if category == "overall":
        schema_prompt = """{
  "summary": "<Detailed, comprehensive 6-8 sentence clinical summary evaluating their complete progression, integrating highlights from multiple physiological boundaries. Mention the sport. Objective, no fluff.>"
}"""
    else:
        schema_prompt = """{
  "summary": "<2-3 sentence clinical summary of this system's overall progress. Mention the sport. Objective, no fluff.>",
  "metrics": [
    {
      "label": "<exact metric label from above>",
      "what": "<1 sentence: quantify what changed and whether it is clinically significant>",
      "why": "<1-2 sentences: most probable physiological or training reason for this change>",
      "how": "<1-2 sentences: specific, actionable training/nutrition/recovery prescription to improve or protect this metric>"
    }
  ]
}"""

    return f"""
You are an elite sports physiologist analysing CPET progress between two tests.

Athlete Profile:
  Name: {profile.get("Name", profile.get("Athlete Name", "Unknown"))}
  Sport: {profile.get("Sport", "Unknown")}
  Age: {profile.get("Age", "Unknown")}
  Gender: {profile.get("Gender", "Unknown")}

Category: {meta["name"]}
Focus Variables: {meta["variables"]}
Clinical Focus: {meta["focus"]}

Metric Changes (Baseline → Follow-up):
{metrics_block}

Return ONLY a single valid JSON object (no markdown fences, no explanation outside the JSON) in the following exact schema:

{schema_prompt}

Rules:
- Include only metrics that have data (skip "no data available" entries).
- Each "what", "why", "how" field: max 40 words.
- Strictly objective, clinical tone matching ACSM standards.
- Do not reference metrics from other categories.
- Return nothing outside the JSON object.
""".strip()
