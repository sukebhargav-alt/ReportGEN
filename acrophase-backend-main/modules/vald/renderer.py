from __future__ import annotations

import asyncio
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
                margin={"top": "48px", "bottom": "45px", "left": "48px", "right": "48px"},
                display_header_footer=True,
                header_template="<div></div>",
                footer_template="""
                <div style="width:100%;padding:0 48px;color:#94a3b8;font:8px Arial,sans-serif;display:flex;justify-content:space-between;">
                  <span>AcroReports | Clinical Performance Assessment</span>
                  <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
                </div>
                """,
            )
        )
        browser.close()


async def render_vald_joint_pdf(buffer, data: dict[str, Any]) -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _render_pdf, buffer, data)
