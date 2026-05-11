from playwright.sync_api import sync_playwright  # type: ignore
from jinja2 import Environment, FileSystemLoader  # type: ignore
import os
import re
import asyncio
import markdown  # type: ignore
import base64
from typing import Any, Dict, List

def compute_metric_displays(profile: dict, sections: list) -> list:
    """Compute gauge / highlight display objects for every section's metric_items."""

    # ── Profile ──────────────────────────────────────────────────────────────
    try:
        age_str = str(profile.get("Age", profile.get("Age (years)", "35")))
        age = int(float(age_str.replace("yr", "").replace("years", "").strip()))
    except Exception:
        age = 35

    gender_raw = str(profile.get("Gender", "M")).strip().upper()
    gender = "M" if gender_raw.startswith("M") else "F"

    try:
        weight_raw = str(profile.get("Weight", profile.get("Weight (kg)")))
        weight_kg = float(weight_raw.replace("kg", "").replace("(kg)", "").strip())
    except Exception:
        weight_kg = 70.0

    # Classic HRmax formula
    hrmax = round(220 - age, 1)

    # ── ACSM VO2max norms ────────────────────────────────────────────────────
    # boundaries = [Poor|Fair, Fair|Good, Good|Excellent, Excellent|Superior]
    # Mapped from 7-tier reference table to 5-tier UI:
    # Poor (Very Poor & Poor), Fair (Below Avg & Avg), Good (Above Avg), Excellent (Good), Superior (Excellent)
    VO2_NORMS = {
        "M": {(18,25):[36,46,51,60], (26,35):[34,42,48,56], (36,45):[30,38,42,51],
              (46,55):[28,35,38,45], (56,65):[25,31,35,41], (66,99):[21,28,32,37]},
        "F": {(18,25):[32,41,46,56], (26,35):[30,38,44,52], (36,45):[26,33,37,45],
              (46,55):[24,30,33,40], (56,65):[21,27,31,37], (66,99):[18,24,27,32]},
    }

    def get_vo2_bounds(g, a):
        norms = VO2_NORMS.get(g, VO2_NORMS["M"])
        for (lo, hi), bounds in norms.items():
            if lo <= a <= hi:
                return bounds
        if a < 18:
            return norms[(18,25)]
        else:
            return norms[(66,99)]

    # ── Other gauge bounds ────────────────────────────────────────────────────
    GAUGE_BOUNDS = {
        "hrr":        [10, 15, 20, 25],   # bpm recovery
        "hr_pct":     [60, 70, 81, 90],   # % HRmax
        "mets":       [5,  8,  11, 14],   # METs
    }

    ZONES_5 = ["Poor", "Fair", "Good", "Excellent", "Superior"]

    # ── Highlight bounds: (low, high) ─────────────────────────────────────────
    HIGHLIGHT_BOUNDS = {
        "vo2":    (1.5,  4.5,  "L/min"),
        "vco2":   (1.2,  4.0,  "L/min"),
        "rr":     (20,   50,   "br/min"),
        "peto2":  (85,   110,  "mmHg"),
        "petco2": (35,   45,   "mmHg"),
        "rq":     (0.7,  1.0,  ""),
        "rer":    (0.7,  1.0,  ""),
        "eeh":    (200,  800,  "kcal/hr"),
    }

    # ── Chart Titles by Section ──────────────────────────────────────────────
    SECTION_CHART_TITLES = {
        "Ventilation System": ["VE vs Time", "VE vs VCO2", "VE/VO2 & VE/VCO2 vs Time"],
        "Cardiovascular System": ["HR vs VO2", "VO2 & VCO2 vs Time"],
        "Ventilatory Perfusion": ["VT vs VE", "PetO2, PetCO2, PaCO2_e vs Time"],
        "Metabolic System": ["RQ & HR vs Time"],
        "Metabolic Efficiency (RQ & HR vs Time)": ["RQ & HR vs Time"]
    }
    def _pos_cat(value, bounds):
        """Map a value to (position 0-1, category string) given 4 zone-boundary values."""
        # 5 equal-width zones, each 0.2 wide
        b = bounds
        if value <= b[0]:
            pos = min(0.18, value / b[0] * 0.2) if b[0] > 0 else 0.01
            cat = "Poor"
        elif value <= b[1]:
            pos = 0.2 + (value - b[0]) / (b[1] - b[0]) * 0.2
            cat = "Fair"
        elif value <= b[2]:
            pos = 0.4 + (value - b[1]) / (b[2] - b[1]) * 0.2
            cat = "Good"
        elif value <= b[3]:
            pos = 0.6 + (value - b[2]) / (b[3] - b[2]) * 0.2
            cat = "Excellent"
        else:
            extra = b[3] * 0.5
            pos = min(0.97, 0.8 + (value - b[3]) / extra * 0.2)
            cat = "Superior"
        return round(max(0.02, min(0.97, pos)), 3), cat

    def _get_range_labels(bounds, unit=""):
        # Returns 5 sub-labels for the 5 zones
        if not bounds or len(bounds) < 4: return []
        b = bounds
        u = unit
        return [
            f"<{b[0]}{u}",
            f"{b[0]}\u2013{b[1]}{u}",
            f"{b[1]}\u2013{b[2]}{u}",
            f"{b[2]}\u2013{b[3]}{u}",
            f">{b[3]}{u}"
        ]

    def _highlight(value, low, high, unit, range_label=None):
        # Splitting highlights into 5 zones for visual consistency:
        # Low, Below-Normal, Normal, Above-Normal, High
        span = high - low
        step = span / 3.0
        
        b = [low, low + step, low + 2*step, high]
        pos, status_map = _pos_cat(value, b)
        
        status = status_map

        return {
            "type": "highlight",
            "value": value,
            "unit": unit,
            "status": status,
            "position": pos,
            "low_bound": low,
            "high_bound": high,
            "range_label": range_label or f"Normal: {low}\u2013{high} {unit}".strip(),
            "zones": ZONES_5,
            "range_labels": _get_range_labels([round(x, 1) for x in b], unit)
        }

    vo2_max_gauge = None
    for section in sections:
        # -- Update Charts with descriptive titles --
        s_title = section.get("title", "")
        if s_title in SECTION_CHART_TITLES:
            titles = SECTION_CHART_TITLES[s_title]
            for idx, chart in enumerate(section.get("charts", [])):
                if idx < len(titles):
                    # Replace if missing or generic
                    curr_t = str(chart.get("title", "")).strip()
                    if not curr_t or curr_t.lower().startswith("chart"):
                        chart["title"] = titles[idx]

        displays = []
        for mi in section.get("metric_items", []):
            label    = mi.get("label", "")
            raw_val  = mi.get("meas_value")
            unit     = mi.get("unit", "")
            if raw_val is None:
                continue
            try:
                value = float(raw_val)
            except Exception:
                continue

            ll = label.lower()   # lower-cased label for matching

            # ── VO2 Max / VO2/kg → gauge --------------------------------------
            is_vo2_max = "vo2 max" in ll or "vo2/kg" in ll or "vo2 /kg" in ll or ll == "vo2"
            
            if is_vo2_max:
                unit_l = unit.lower()
                if "l/min" in unit_l and "ml" not in unit_l and weight_kg > 0:
                    value = (value * 1000) / weight_kg
                    unit = "mL/kg/min"
                elif "ml/min" in unit_l and "kg" not in unit_l and weight_kg > 0:
                    value = value / weight_kg
                    unit = "mL/kg/min"
                
                bounds = get_vo2_bounds(gender, age)
                pos, cat = _pos_cat(value, bounds)
                vo2_max_gauge = {"type": "gauge", "label": "VO2 Max",
                    "value": round(value, 1), "unit": unit or "mL/kg/min",
                    "category": cat, "position": pos, "zones": ZONES_5,
                    "range_labels": _get_range_labels(bounds, "")}
                continue



            # ── HR at VT1 → highlight (% HRmax band) ─────────────────────────
            elif "vt1" in ll and "hr" in ll:
                lo = round(hrmax * 0.55, 0)
                hi = round(hrmax * 0.75, 0)
                d = _highlight(value, lo, hi, unit or "bpm",
                               f"Normal: 55\u201375% HRmax ({lo:.0f}\u2013{hi:.0f} bpm)")
                d["label"] = "HR at VT1"
                displays.append(d)

            # ── HR at VT2 → highlight (% HRmax band) ─────────────────────────
            elif "vt2" in ll and "hr" in ll:
                lo = round(hrmax * 0.80, 0)
                hi = round(hrmax * 0.95, 0)
                d = _highlight(value, lo, hi, unit or "bpm",
                               f"Normal: 80\u201395% HRmax ({lo:.0f}\u2013{hi:.0f} bpm)")
                d["label"] = "HR at VT2"
                displays.append(d)

            # ── HRR → simple metric ──────────────────────────────────────────
            elif "hrr" in ll or "heart rate reserve" in ll:
                d = _highlight(value, 10, 25, unit or "beats/min", "Normal: \u2265 15 beats/min")
                d["label"] = "Heart Rate Reserve"
                d["type"] = "simple"
                displays.append(d)

            # ── O2 Pulse → simple metric ─────────────────────────────────────────
            elif "o2 pulse" in ll or "o2/hr" in ll or "vo2/hr" in ll:
                pred_o2_pulse = 23.2 - (0.09 * age)
                if gender == "F":
                    pred_o2_pulse -= 6.6
                lo = pred_o2_pulse * 0.60
                hi = pred_o2_pulse * 1.20
                d = _highlight(value, lo, hi, unit or "ml/beat", f"Predicted: {pred_o2_pulse:.1f} ml/beat")
                d["label"] = "O2 Pulse"
                d["type"] = "simple"
                displays.append(d)

            # ── RF / RR → simple metric ──────────────────────────────────────────
            elif "rf" in ll or "rr" in ll or "respiratory frequency" in ll:
                d = _highlight(value, 30, 60, unit or "br/min", "General Pop Max: <50 | Elite: 60-70")
                d["label"] = "Respiratory Frequency"
                d["type"] = "simple"
                displays.append(d)

            # ── Generic highlight lookup ───────────────────────────────────────
            else:
                matched_key = next((k for k in HIGHLIGHT_BOUNDS if k == ll or k in ll), None)
                if matched_key:
                    lo, hi, default_unit = HIGHLIGHT_BOUNDS[matched_key]
                    d = _highlight(value, lo, hi, unit or default_unit)
                    d["label"] = label
                    displays.append(d)

        # Remove sliders (metric displays) entirely for these sections
        if section.get("title") in ["Ventilatory Perfusion", "Metabolic System"]:
            displays = []

        section["metric_displays"] = displays

    hr_vt1 = profile.get("hr_vt1")
    hr_vt2 = profile.get("hr_vt2")

    if hr_vt1 is None or hr_vt2 is None:
        for section in sections:
            for md in section.get("metric_displays", []):
                if md.get("label") == "HR at VT1" and hr_vt1 is None:
                    hr_vt1 = md.get("value")
                elif md.get("label") == "HR at VT2" and hr_vt2 is None:
                    hr_vt2 = md.get("value")

    hr_max_val = profile.get("HR Max", profile.get("HR Peak", hrmax))
    try:
        current_hr_max = float(hr_max_val)
    except Exception:
        current_hr_max = hrmax
        
    hr_zones = {
        "hr_max": current_hr_max,
        "hr_vt1": hr_vt1,
        "hr_vt2": hr_vt2,
        "zones": [
            {"zone": 1, "range": "50-60%", "min": round(current_hr_max * 0.50), "max": round(current_hr_max * 0.60), "description": "Light"},
            {"zone": 2, "range": "60-75%", "min": round(current_hr_max * 0.60), "max": round(current_hr_max * 0.75), "description": "Moderate"},
            {"zone": 3, "range": "75-85%", "min": round(current_hr_max * 0.75), "max": round(current_hr_max * 0.85), "description": "Vigorous"},
            {"zone": 4, "range": "85-95%", "min": round(current_hr_max * 0.85), "max": round(current_hr_max * 0.95), "description": "Hard"},
            {"zone": 5, "range": "95-100%", "min": round(current_hr_max * 0.95), "max": round(current_hr_max * 1.00), "description": "Maximal"},
        ]
    }

    return sections, hr_zones, vo2_max_gauge

def _sync_render_cpet(buffer, data):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(base_dir, "templates")
    static_dir = os.path.join(base_dir, "..", "..", "static")

    if "sections" in data:
        for section in data["sections"]:
            if "insight" in section and section["insight"]:
                raw_insight = section["insight"]
                
                # Markers for specialized sub-interpretations
                sub_markers = {
                    "Aerobic Capacity Interpretation": "aerobic_capacity_insight",
                    "Ventilatory Thresholds Interpretation": "vt_thresholds_insight",
                    "RQ & HR vs Time Interpretation": "rq_hr_insight"
                }
                
                found_marker = False
                for marker, target_key in sub_markers.items():
                    # Look for the marker with potential markdown headers or just bold text
                    pattern = rf'(?:###\s*|##\s*|#\s*|\*\*\s*|)' + re.escape(marker)
                    if re.search(pattern, raw_insight, flags=re.IGNORECASE):
                        parts = re.split(rf'({pattern})', raw_insight, flags=re.IGNORECASE)
                        if len(parts) >= 3:
                            section["insight"] = markdown.markdown(parts[0].strip())
                            section[target_key] = markdown.markdown((parts[1] + parts[2]).strip())
                            found_marker = True
                            break
                
                if not found_marker:
                    section["insight"] = markdown.markdown(raw_insight)

    if data.get("overall_interpretation"):
        data["overall_interpretation"] = markdown.markdown(data["overall_interpretation"])

    if data.get("final_recommendations"):
        data["final_recommendations"] = markdown.markdown(data["final_recommendations"])

    if "sections" in data:
        resp = compute_metric_displays(data.get("profile", {}), data["sections"])
        if len(resp) == 3:
            data["sections"], data["hr_zones"], data["vo2_max_gauge"] = resp
        else:
            data["sections"], data["hr_zones"] = resp
        
        # ── Performance Highlights ───────────────────────────────────────────────
        # Extract the "Big Three" charts for the dedicated athlete/coach page
        highlights = []
        # Map original chart titles to display titles AND their source section/sub-insight key
        target_charts = [
            {
                "original": "VO2 & VCO2 vs Time",
                "display": "Aerobic Capacity & Peak Output",
                "sub_key": "aerobic_capacity_insight"
            },
            {
                "original": "VE/VO2 & VE/VCO2 vs Time",
                "display": "Ventilatory Thresholds & Training Zones",
                "sub_key": "vt_thresholds_insight"
            },
            {
                "original": "RQ & HR vs Time",
                "display": "Metabolic crossover & Fueling",
                "sub_key": "rq_hr_insight"
            }
        ]
        
        for target in target_charts:
            match_chart = None
            match_interpretation = ""
            
            for section in data["sections"]:
                for chart in section.get("charts", []):
                    if str(chart.get("title", "")).strip() == target["original"]:
                        match_chart = chart
                        # Look for interpretation in the same section
                        match_interpretation = section.get(target["sub_key"], "")
                        break
                if match_chart: break
            
            if match_chart:
                highlights.append({
                    "b64": match_chart["b64"],
                    "title": target["display"],
                    "interpretation": match_interpretation,
                    "original_title": target["original"]
                })
        
        data["performance_highlights"] = highlights

    logo_file_path = os.path.join(static_dir, "logo.png")
    with open(logo_file_path, "rb") as f:
        logo_base64 = base64.b64encode(f.read()).decode("utf-8")

    env = Environment(loader=FileSystemLoader(templates_dir))
    template = env.get_template("cpet_premium_report.html")

    html_out = template.render(data=data)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html_out, wait_until="load")

        pdf_bytes = page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "125px", "bottom": "70px", "left": "65px", "right": "65px"},
            display_header_footer=True,
            header_template=f"""
                <div style="width:100%; padding:24px 65px 16px 65px; font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif; border-bottom:2px solid #ff8c00; display:flex; justify-content:space-between; align-items:flex-end;">
                    <div style="display:flex; align-items:center;">
                        <img src="data:image/png;base64,{logo_base64}" style="height:32px; margin-right:16px;" />
                        <span style="font-weight:800; color:#ff8c00; font-size:18px; letter-spacing:1.6px;">ACROPHASE</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:700; font-size:20px; letter-spacing:0.3px; color:#111;">{data.get("profile", {}).get("Name", data.get("profile", {}).get("Athlete Name", ""))}</div>
                        <div style="font-size:13px; font-weight:600; color:#555; margin-top:4px;">{data.get("profile", {}).get("Sport","")}</div>
                    </div>
                </div>""",
            footer_template="""
                <div style="width:100%; padding:0 65px; font-size:8px; font-family:Inter,sans-serif; color:#a0a0a0; display:flex; justify-content:space-between;">
                    <span>High Performance CPET Report</span>
                    <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
                </div>"""
        )
        buffer.write(pdf_bytes)
        browser.close()

async def render_cpet_premium_pdf(buffer, data):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _sync_render_cpet, buffer, data)
    await loop.run_in_executor(None, _sync_render_cpet, buffer, data)
