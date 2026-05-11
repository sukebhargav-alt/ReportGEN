"""
Playwright-based renderer for the CPET Progress Comparison PDF report.

Produces a clean, premium 6-8 page report covering:
  Page 1 – Cover (athlete, sport, dates, overall score, pill counts)
  Page 2 – Progress Summary (radar chart image, category strip, KPI timeline)
  Page 3 – Aerobic & Cardiovascular metric tables + What/Why/How
  Page 4 – Ventilation & Metabolic metric tables + What/Why/How
  Page 5 – Threshold & Reference metrics + AI system interpretations
  Page 6-7 – AI system summaries continued (Aerobic, CV, Ventilation, Metabolic, Threshold)
  Page 7-8 – Final Recommendations (if provided)
"""

from __future__ import annotations

import asyncio
import base64
import os
import re
from typing import Any, Dict, List, Optional

from playwright.sync_api import sync_playwright  # type: ignore

# ---------------------------------------------------------------------------
# Colour palette — mirrors the frontend category accents
# ---------------------------------------------------------------------------
CAT_COLORS: Dict[str, str] = {
    "cardiovascular": "#ef4444",   # red-500
    "ventilation":    "#3b82f6",   # blue-500
    "perfusion":      "#10b981",   # emerald-500
    "metabolic":      "#8b5cf6",   # violet-500
}

CAT_LABELS: Dict[str, str] = {
    "cardiovascular": "Cardiovascular System",
    "ventilation":    "Ventilation System",
    "perfusion":      "Ventilatory Perfusion",
    "metabolic":      "Metabolic System",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt(val: Any, unit: str = "") -> str:
    if val is None:
        return "N/A"
    try:
        v = float(val)
        if unit == "s" and v >= 60:
            m = int(v // 60)
            s = int(v % 60)
            return f"{m}:{s:02d}"
        if abs(v) >= 100:
            return f"{v:.0f}"
        if abs(v) >= 10:
            return f"{v:.1f}"
        return f"{v:.2f}"
    except Exception:
        return str(val)


def _fmt_delta(delta: Any, delta_pct: Any, improvement: str | None) -> str:
    if delta is None:
        return "—"
    try:
        d = float(delta)
        pct_str = f" ({float(delta_pct):+.1f}%)" if delta_pct is not None else ""
        sign = "+" if d >= 0 else ""
        if abs(d) >= 100:
            return f"{sign}{d:.0f}{pct_str}"
        if abs(d) >= 10:
            return f"{sign}{d:.1f}{pct_str}"
        return f"{sign}{d:.2f}{pct_str}"
    except Exception:
        return "—"


def _improvement_color(improvement: str | None) -> str:
    return {
        "better":    "#059669",
        "worse":     "#dc2626",
        "neutral":   "#6b7280",
        "reference": "#d97706",
    }.get(improvement or "", "#6b7280")


def _improvement_badge(improvement: str | None) -> str:
    cfg = {
        "better":    ("↑ Better",    "#d1fae5", "#065f46"),
        "worse":     ("↓ Declined",  "#fee2e2", "#991b1b"),
        "neutral":   ("→ Stable",    "#f3f4f6", "#374151"),
        "reference": ("● Reference","#fef3c7", "#92400e"),
    }
    text, bg, color = cfg.get(improvement or "neutral", ("—", "#f3f4f6", "#374151"))
    return (
        f'<span style="background:{bg}; color:{color}; font-size:9px; '
        f'font-weight:800; padding:2px 8px; border-radius:12px; '
        f'white-space:nowrap;">{text}</span>'
    )


# ---------------------------------------------------------------------------
# HTML template builder
# ---------------------------------------------------------------------------

def _build_html(data: Dict[str, Any], logo_b64: str) -> str:  # noqa: C901
    profile      = data.get("profile", {})
    metrics      = data.get("metrics", [])        # list[ComparisonMetric-like dicts]
    insights     = data.get("insights", {})       # category → {summary, metrics:[{label,what,why,how}]}
    radar_b64    = data.get("radar_b64", "")      # base64 PNG of radar chart
    overall      = data.get("overall_score", 50)  # Unused but kept for legacy unpacking compatibility
    improved     = data.get("improved_count", 0)
    declined     = data.get("declined_count", 0)
    unchanged    = data.get("unchanged_count", 0)
    baseline_date = data.get("baseline_date", "Test 1")
    followup_date = data.get("followup_date", "Test 2")
    final_recs   = data.get("final_recommendations", "")

    athlete_name = (
        profile.get("Name")
        or f"{profile.get('First Name', '')} {profile.get('Last Name', '')}".strip()
        or profile.get("Athlete Name", "Athlete")
    )
    sport    = profile.get("Sport", "")
    val = profile.get("Age")
    if val is None or str(val).strip() == "":
        val = profile.get("Age (years)")

    age = ""
    if val is not None and str(val).strip() != "":
        cleaned = re.sub(r'[^0-9.]', '', str(val))
        if cleaned:
            try:
                age = str(int(float(cleaned)))
            except Exception:
                age = ""

    gender   = profile.get("Gender", "")
    weight   = profile.get("Weight (kg)", profile.get("Weight", ""))

    CATEGORIES_ORDER = ["ventilation", "cardiovascular", "perfusion", "metabolic"]

    # Per-category AI What/Why/How lookup
    def _ai_lookup(category: str, label: str) -> dict:
        cat_insight = insights.get(category, {})
        if isinstance(cat_insight, str):
            return {}
        for entry in cat_insight.get("metrics", []):
            if entry.get("label", "").lower().strip() == label.lower().strip():
                return entry
        return {}

    def _render_metric_table(category: str) -> str:
        cat_metrics = [m for m in metrics if m.get("category") == category]
        if not cat_metrics:
            return "<p style='color:#9ca3af; font-size:11px; font-style:italic;'>No data available.</p>"

        rows_html = ""
        for m in cat_metrics:
            label    = m.get("label", "")
            unit     = m.get("unit", "")
            baseline = m.get("baseline")
            followup = m.get("followUp")
            delta    = m.get("delta")
            dpct     = m.get("deltaPercent")
            impr     = m.get("improvement")
            ai       = _ai_lookup(category, label)

            is_ref   = impr == "reference"
            delta_html = "—" if is_ref else _fmt_delta(delta, dpct, impr)
            delta_color = _improvement_color(impr)
            badge_html  = _improvement_badge(impr)
            ai_block = ""
            if ai.get("what"):
                ai_block = f"""
                <tr>
                  <td colspan="5" style="padding:4px 6px 10px 12px; background:#f9fafb; border-bottom:1px solid #e5e7eb;">
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
                      <div><span style="font-size:8px; font-weight:800; text-transform:uppercase; color:#f97316; letter-spacing:0.8px;">What</span><br/><span style="font-size:10px; color:#374151; line-height:1.5;">{ai.get("what","")}</span></div>
                      <div><span style="font-size:8px; font-weight:800; text-transform:uppercase; color:#3b82f6; letter-spacing:0.8px;">Why</span><br/><span style="font-size:10px; color:#374151; line-height:1.5;">{ai.get("why","")}</span></div>
                      <div><span style="font-size:8px; font-weight:800; text-transform:uppercase; color:#10b981; letter-spacing:0.8px;">How</span><br/><span style="font-size:10px; color:#374151; line-height:1.5;">{ai.get("how","")}</span></div>
                    </div>
                  </td>
                </tr>"""

            rows_html += f"""
            <tr>
              <td style="padding:8px 6px; font-size:11px; font-weight:600; color:#111827; border-bottom:1px solid #f3f4f6;">{label}</td>
              <td style="padding:8px 6px; font-size:11px; color:#6b7280; text-align:center; border-bottom:1px solid #f3f4f6;">{unit or "—"}</td>
              <td style="padding:8px 6px; font-size:11px; color:#374151; text-align:right; border-bottom:1px solid #f3f4f6;">{_fmt(baseline, unit)}</td>
              <td style="padding:8px 6px; font-size:11px; font-weight:700; color:#111827; text-align:right; border-bottom:1px solid #f3f4f6;">{_fmt(followup, unit)}</td>
              <td style="padding:8px 6px; font-size:11px; font-weight:700; color:{delta_color}; text-align:right; border-bottom:1px solid #f3f4f6; white-space:nowrap;">{delta_html} {badge_html}</td>
            </tr>{ai_block}
            <tr><td colspan="5" style="height:20px;"></td></tr>"""

        return f"""
        <table style="width:100%; border-collapse:collapse; font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:6px 6px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; text-align:left; border-bottom:2px solid #e5e7eb;">Metric</th>
              <th style="padding:6px 6px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; text-align:center; border-bottom:2px solid #e5e7eb;">Unit</th>
              <th style="padding:6px 6px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; text-align:right; border-bottom:2px solid #e5e7eb;">Baseline</th>
              <th style="padding:6px 6px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; text-align:right; border-bottom:2px solid #e5e7eb;">Follow-up</th>
              <th style="padding:6px 6px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; text-align:right; border-bottom:2px solid #e5e7eb;">Change</th>
            </tr>
          </thead>
          <tbody>{rows_html}</tbody>
        </table>"""

    def _render_category_block(category: str) -> str:
        color  = CAT_COLORS.get(category, "#6b7280")
        label  = CAT_LABELS.get(category, category.title())
        summary = ""
        cat_insight = insights.get(category, {})
        if isinstance(cat_insight, dict):
            summary = cat_insight.get("summary", "")

        summary_html = ""
        if summary:
            summary_html = f"""
            <div style="background:#f9fafb; border-left:3px solid {color}; padding:8px 12px; border-radius:0 8px 8px 0; margin-bottom:10px;">
              <p style="font-size:11px; color:#374151; line-height:1.6; margin:0;">{summary}</p>
            </div>"""

        return f"""
        <div style="margin-bottom:20px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <div style="width:4px; height:20px; border-radius:2px; background:{color};"></div>
            <h3 style="font-size:13px; font-weight:800; color:#111827; margin:0; letter-spacing:0.3px;">{label}</h3>
          </div>
          {summary_html}
          {_render_metric_table(category)}
        </div>"""

    # ── Build category pages ────────────────────────────────────────────────
    page_ventilation = _render_category_block("ventilation")
    page_cardiovascular = _render_category_block("cardiovascular")
    page_perfusion = _render_category_block("perfusion")
    page_metabolic = _render_category_block("metabolic")

    # ── Radar chart image ─────────────────────────────────────────────────────
    radar_html = ""
    if radar_b64:
        radar_html = f"""
    <div style="text-align:center; margin-bottom:16px;">
      <h3 style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; margin-bottom:4px;">Performance Radar Breakdown</h3>
      <div style="font-size:10px; color:#6b7280; font-weight:600; margin-bottom:16px;">(Dashed line = Baseline 0%. Solid plot = Multi-system improvement %)</div>
      <img src="data:image/png;base64,{radar_b64}" style="max-width:100%; height:250px; border-radius:12px;" />
    </div>
    """

    # ── Final recommendations ─────────────────────────────────────────────────
    recs_page = ""
    if final_recs and final_recs.strip():
        recs_page = (
            '<div class="page-break">'
            '<div style="background:linear-gradient(135deg,#0f172a,#1e293b); color:#fff; '
            'padding:12px 16px; border-radius:10px; margin-bottom:16px;">'
            '<div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#94a3b8; '
            'text-transform:uppercase; margin-bottom:4px;">Coaching Prescriptions</div>'
            f'<div style="font-size:18px; font-weight:800;">Final Recommendations</div>' 
            '</div>'
            f'<div style="background:#fafafa; border:1px solid #e5e7eb; border-radius:10px; '
            f'padding:16px; font-size:12px; line-height:1.7; color:#374151; '
            f'white-space:pre-wrap;">{final_recs}</div>'
            '</div>'
        )

    # ── Pre-build Overall Insight for Cover  ──────────────────────────────────
    overall_insight = insights.get("overall", {})
    if isinstance(overall_insight, dict):
        overall_summary = overall_insight.get("summary", "Overall performance analysis not available.")
    else:
        overall_summary = "Overall performance analysis not available."

    overall_insights_html = f"""
    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:20px; margin-bottom:16px;">
        <h3 style="font-size:14px; font-weight:800; color:#111827; margin-bottom:10px; border-bottom:1px solid #e5e7eb; padding-bottom:8px;">Key Findings & Takeaways</h3>
        <p style="font-size:12px; color:#374151; line-height:1.7; margin:0; white-space:pre-wrap;">{overall_summary}</p>
    </div>
    """

    return f"""<!doctype html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif;
    font-size: 13px;
    color: #1d1d1f;
    line-height: 1.5;
  }}
  .page-break {{ page-break-before: always; }}
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE 1 — COVER & EXECUTIVE SUMMARY
════════════════════════════════════════════════════════════════════════════ -->
<div style="font-size:9px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#f97316; margin-bottom:12px;">Athlete Progress Report · CPET Comparison</div>

<div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
  <h2 style="font-size:18px; font-weight:700; color:#111827; margin:0 0 12px; border-bottom:1px solid #f3f4f6; padding-bottom:8px;">Athlete Details</h2>
  <div style="display:grid; grid-template-columns:1fr 1fr; column-gap:24px; row-gap:8px;">
    
    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:4px;">
      <span style="font-size:13px; color:#4b5563; font-weight:500;">Name</span>
      <span style="font-size:13px; color:#111827; font-weight:700;">{athlete_name}</span>
    </div>
    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:4px;">
      <span style="font-size:13px; color:#4b5563; font-weight:500;">Baseline Date</span>
      <span style="font-size:13px; color:#111827; font-weight:700;">{baseline_date or "-"}</span>
    </div>

    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:4px;">
      <span style="font-size:13px; color:#4b5563; font-weight:500;">Age & Gender</span>
      <span style="font-size:13px; color:#111827; font-weight:700;">{f"{age} yrs" if age else "N/A"} · {gender or "-"}</span>
    </div>
    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:4px;">
      <span style="font-size:13px; color:#4b5563; font-weight:500;">Follow-up Date</span>
      <span style="font-size:13px; color:#111827; font-weight:700;">{followup_date or "-"}</span>
    </div>

    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:4px;">
      <span style="font-size:13px; color:#4b5563; font-weight:500;">Sport</span>
      <span style="font-size:13px; color:#111827; font-weight:700;">{sport or "-"}</span>
    </div>
    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:4px;">
      <span style="font-size:13px; color:#4b5563; font-weight:500;">Weight</span>
      <span style="font-size:13px; color:#111827; font-weight:700;">{str(weight) + " kg" if weight else "-"}</span>
    </div>

  </div>
</div>

<!-- Score + Stats row -->
<div style="display:flex; gap:8px; margin-bottom:16px;">
  <div style="flex:1; background:#ecfdf5; border:1px solid #6ee7b7; border-radius:10px; padding:12px 14px;">
    <div style="font-size:22px; font-weight:900; color:#065f46;">{improved}</div>
    <div style="font-size:10px; font-weight:700; color:#10b981; text-transform:uppercase; letter-spacing:0.8px;">Improved</div>
  </div>
  <div style="flex:1; background:#fef2f2; border:1px solid #fca5a5; border-radius:10px; padding:12px 14px;">
    <div style="font-size:22px; font-weight:900; color:#991b1b;">{declined}</div>
    <div style="font-size:10px; font-weight:700; color:#ef4444; text-transform:uppercase; letter-spacing:0.8px;">Declined</div>
  </div>
  <div style="flex:1; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px;">
    <div style="font-size:22px; font-weight:900; color:#374151;">{unchanged}</div>
    <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.8px;">Unchanged</div>
  </div>
</div>

{radar_html if radar_html else ''}

{overall_insights_html}

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE 2 — CARDIOVASCULAR SYSTEM
════════════════════════════════════════════════════════════════════════════ -->
<div class="page-break">
  <div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#9ca3af; text-transform:uppercase; margin-bottom:16px;">System Mastery — Cardiovascular</div>
  {page_cardiovascular}
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE 3 — VENTILATORY PERFUSION
════════════════════════════════════════════════════════════════════════════ -->
<div class="page-break">
  <div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#9ca3af; text-transform:uppercase; margin-bottom:16px;">System Mastery — Perfusion</div>
  {page_perfusion}
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE 4 — METABOLIC SYSTEM
════════════════════════════════════════════════════════════════════════════ -->
<div class="page-break">
  <div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#9ca3af; text-transform:uppercase; margin-bottom:16px;">System Mastery — Metabolic</div>
  {page_metabolic}
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE 5 — VENTILATION SYSTEM
════════════════════════════════════════════════════════════════════════════ -->
<div class="page-break">
  <div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#9ca3af; text-transform:uppercase; margin-bottom:16px;">System Mastery — Ventilation</div>
  {page_ventilation}
</div>

{recs_page}

<!-- Clinical disclaimer -->
<div style="background:#fefce8; border:1px solid #fef08a; border-radius:8px; padding:10px 14px; margin-top:16px;">
  <p style="font-size:9px; color:#713f12; line-height:1.5; margin:0;">
    <strong>Clinical Disclaimer:</strong> This report is generated from CPET data using ACSM normative reference logic and AI-assisted interpretation.
    It is intended to support — not replace — qualified clinical and coaching judgement.
    Reference metrics (HR Max, Peak RQ) are displayed without improvement arrows to prevent misinterpretation.
  </p>
</div>

</body>
</html>"""


# ---------------------------------------------------------------------------
# Sync render (called via run_in_executor)
# ---------------------------------------------------------------------------

def _sync_render_comparison(buffer, data: Dict[str, Any]):
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "static")
    logo_file  = os.path.join(static_dir, "logo.png")

    with open(logo_file, "rb") as f:
        logo_b64 = base64.b64encode(f.read()).decode("utf-8")

    html_out = _build_html(data, logo_b64)

    profile = data.get("profile", {})
    athlete_name = (
        profile.get("Name")
        or f"{profile.get('First Name', '')} {profile.get('Last Name', '')}".strip()
        or profile.get("Athlete Name", "Athlete")
    )

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page    = browser.new_page()
        page.set_content(html_out, wait_until="load")

        pdf_bytes = page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "115px", "bottom": "65px", "left": "55px", "right": "55px"},
            display_header_footer=True,
            header_template=f"""
                <div style="width:100%; padding:20px 55px 12px 55px;
                            font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;
                            border-bottom:2px solid #f97316;
                            display:flex; justify-content:space-between; align-items:flex-end;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <img src="data:image/png;base64,{logo_b64}"
                         style="height:28px; margin-right:10px;"/>
                    <span style="font-weight:800; color:#f97316; font-size:16px; letter-spacing:1.6px;">ACROPHASE</span>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-weight:700; font-size:15px; color:#111;">{athlete_name}</div>
                    <div style="font-size:11px; color:#6b7280; margin-top:2px;">Progress Comparison Report</div>
                  </div>
                </div>""",
            footer_template="""
                <div style="width:100%; padding:0 55px; font-size:8px;
                            font-family:Inter,sans-serif; color:#a0a0a0;
                            display:flex; justify-content:space-between;">
                  <span>CPET Progress Report · Acrophase</span>
                  <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
                </div>"""
        )
        buffer.write(pdf_bytes)
        browser.close()


# ---------------------------------------------------------------------------
# Public async entry point
# ---------------------------------------------------------------------------

async def render_comparison_pdf(buffer, data: Dict[str, Any]):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _sync_render_comparison, buffer, data)
