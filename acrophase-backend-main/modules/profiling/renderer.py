from playwright.sync_api import sync_playwright  # type: ignore
from jinja2 import Environment, FileSystemLoader  # type: ignore
import os
import asyncio
import markdown  # type: ignore
import base64
from typing import Any, Dict, List

def ensure_profile_structure(data: Dict[str, Any]) -> Dict[str, Any]:
    profile: Dict[str, Any] = data.get("profile", {})
    profile["Name"] = profile.get("Athlete Name", "") or ""
    profile["Age"] = profile.get("Age (years)", "") or ""
    profile["Height"] = profile.get("Height (cm) - Self Reported", "") or ""
    profile["Weight"] = profile.get("Weight (kg) - Self Reported", "") or ""
    profile["Sport"] = profile.get("Sport", "") or ""
    profile["Dominant Hand"] = profile.get("Dominant Hand", "") or ""
    profile["Dominant Leg"] = profile.get("Dominant Leg", "") or ""
    profile["Gender"] = profile.get("Gender", "") or ""
    profile["BMI"] = profile.get("BMI", "") or ""
    data["profile"] = profile
    return data

def _sync_render(buffer, data):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(base_dir, "templates")
    static_dir = os.path.join(base_dir, "..", "..", "static")

    data = ensure_profile_structure(data)
    for section in data.get("interpretations", {}):
        data["interpretations"][section] = markdown.markdown(data["interpretations"][section])

    if data.get("final_recommendations"):
        data["final_recommendations"] = markdown.markdown(data["final_recommendations"])

    logo_file_path = os.path.join(static_dir, "logo.png")
    with open(logo_file_path, "rb") as f:
        logo_base64 = base64.b64encode(f.read()).decode("utf-8")

    env = Environment(loader=FileSystemLoader(templates_dir))
    template = env.get_template("premium_report.html")

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
                        <div style="font-weight:700; font-size:20px; letter-spacing:0.3px; color:#111;">{data["profile"].get("Name","")}</div>
                        <div style="font-size:13px; font-weight:600; color:#555; margin-top:4px;">{data["profile"].get("Sport","")} · {data["profile"].get("Age","")} years</div>
                    </div>
                </div>""",
            footer_template="""
                <div style="width:100%; padding:0 65px; font-size:8px; font-family:Inter,sans-serif; color:#a0a0a0; display:flex; justify-content:space-between;">
                    <span>High Performance Athlete Assessment</span>
                    <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
                </div>"""
        )
        buffer.write(pdf_bytes)
        browser.close()

async def render_premium_pdf(buffer, data):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _sync_render, buffer, data)
