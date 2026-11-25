"""Render the shared templates as a standalone static frontend."""
import json
import os
from pathlib import Path
import shutil
from urllib.parse import urlsplit

from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parent


def build():
    api_url = os.environ.get("API_BASE_URL", "").strip().rstrip("/")
    parsed = urlsplit(api_url)
    if (parsed.scheme not in {"http", "https"} or not parsed.netloc
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path):
        raise ValueError("Set API_BASE_URL to your backend origin, e.g. https://backend.onrender.com")

    output = ROOT / "dist"
    output.mkdir(exist_ok=True)
    shutil.copytree(ROOT / "static", output / "static", dirs_exist_ok=True)
    (output / "static" / "config.js").write_text(
        f"window.GATHER_API_BASE_URL = {json.dumps(api_url)};\n", encoding="utf-8"
    )
    routes = {
        "index": "/",
        "registrations_page": "/registrations",
        "organizer_page": "/organizer",
    }

    def url_for(endpoint, **values):
        if endpoint == "static":
            return "/static/" + values["filename"]
        return routes[endpoint]

    env = Environment(loader=FileSystemLoader(ROOT / "templates"),
                      autoescape=select_autoescape(["html"]))
    env.globals["url_for"] = url_for
    pages = {"events.html": "index.html", "event_detail.html": "event.html",
             "registrations.html": "registrations.html", "organizer.html": "organizer.html"}
    for template, filename in pages.items():
        (output / filename).write_text(
            env.get_template(template).render(static_frontend=True, event_id=""),
            encoding="utf-8",
        )
    print("Built standalone frontend in dist/")


if __name__ == "__main__":
    build()
