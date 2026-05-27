from __future__ import annotations

import asyncio
import base64
import os
from copy import deepcopy
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

    base_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(base_dir, "templates")
    static_dir = os.path.join(base_dir, "..", "..", "static")
    with open(os.path.join(static_dir, "logo.png"), "rb") as logo_file:
        logo_base64 = base64.b64encode(logo_file.read()).decode("utf-8")

    env = Environment(
        loader=FileSystemLoader(templates_dir),
        autoescape=select_autoescape(["html", "xml"]),
    )
    env.filters["metric_value"] = format_metric_value
    html = env.get_template("joint_report.html").render(data=payload)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="load")
        buffer.write(
            page.pdf(
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
                    <div style="font-weight:700; font-size:20px; letter-spacing:0.3px; color:#111;">{athlete_name}</div>
                    <div style="font-size:13px; font-weight:600; color:#555; margin-top:4px;">{payload.get("sport") or ""} · {payload.get("assessment_date") or ""}</div>
                  </div>
                </div>""",
                footer_template="""
                <div style="width:100%; padding:0 65px; font-size:8px; font-family:Inter,sans-serif; color:#a0a0a0; display:flex; justify-content:space-between;">
                  <span>High Performance VALD Assessment</span>
                  <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
                </div>
                """,
            )
        )
        browser.close()


async def render_vald_joint_pdf(buffer, data: dict[str, Any]) -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _render_pdf, buffer, data)
