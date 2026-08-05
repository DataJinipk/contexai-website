#!/usr/bin/env python3
"""
Economic Vibes — headless daily brief builder.

Runs in GitHub Actions (no laptop needed). Two-phase design so the AI step can run
through **Claude Code** (billed to your Max subscription via CLAUDE_CODE_OAUTH_TOKEN)
instead of the paid API/Console:

  python build_brief.py emit-prompt   -> writes out/prompt.txt + out/dates.json
  (workflow) claude -p "$(cat out/prompt.txt)" --dangerously-skip-permissions
                                        -> Claude Code researches (web search) and
                                           WRITES out/payload.json
  python build_brief.py render         -> reads out/payload.json, builds PDF + site

Fallback: `python build_brief.py` with ANTHROPIC_API_KEY set uses the API SDK end-to-end
(Console credits) — kept for convenience/testing.

Render steps: print one-pager -> PDF (WeasyPrint); public page; index.html tickers;
sitemap lastmod; LinkedIn/WhatsApp captions. Mirrors DAILY-RUNBOOK.md, server-side.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

# ----------------------------------------------------------------------------- paths
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]                 # .../contexai-website
PUBLIC = REPO_ROOT / "public"
OUT = SCRIPT_DIR / "out"
OUT.mkdir(exist_ok=True)
PROMPT_FILE = OUT / "prompt.txt"
PAYLOAD_FILE = OUT / "payload.json"
DATES_FILE = OUT / "dates.json"

DISCLAIMER = (
    "Disclaimer: Produced by ContexAi for information and education only — not investment "
    "advice, a solicitation, or a guarantee. Trading securities, commodities and futures carries "
    "substantial risk of loss; leveraged futures can lose more than your margin. Levels are "
    "indicative. Consider your risk tolerance and consult a licensed financial adviser before "
    "acting. You alone are responsible for your trading decisions."
)

PKT = ZoneInfo("Asia/Karachi")


# ----------------------------------------------------------------------------- dates
def compute_dates() -> dict:
    now = dt.datetime.now(PKT)
    today = now.date()
    d = today - dt.timedelta(days=1)          # last close = most recent weekday before today
    while d.weekday() >= 5:                    # 5=Sat, 6=Sun
        d -= dt.timedelta(days=1)
    return {
        "iso_date": today.isoformat(),
        "date_long": today.strftime("%A, %d %B %Y"),
        "last_close_long": d.strftime("%A, %d %B %Y"),
        "date_news": today.strftime("%d %b %Y").upper(),
        "pdf_filename": f"{today.isoformat()}-Economic-Vibes-Morning-Brief.pdf",
        "brief_html_filename": f"{today.isoformat()}-economic-vibes-morning-brief.html",
        "docx_filename": f"{today.isoformat()}-Economic-Vibes-Morning-Brief.docx",
    }


# ------------------------------------------------------------------------ the prompt
def build_prompt(dates: dict) -> str:
    return (
        "You are the ContexAi Research desk — a Senior Financial Analyst and market strategist "
        "producing the 'Economic Vibes — Morning News Brief' for a C-suite / HNW audience.\n\n"
        f"Today is {dates['date_long']} (PKT); the most recent market close was "
        f"{dates['last_close_long']}.\n\n"
        "TASK: Research today's markets using web search, then WRITE the result as strict JSON to "
        "the file scripts/economic_vibes/out/payload.json (use your file-writing tool; the file "
        "must contain ONLY the JSON object, no prose, no markdown fences).\n\n"
        "RESEARCH RULES:\n"
        "- Verify EVERY market figure across at least two licensed sources (Business Recorder, "
        "Dawn, Express Tribune, Mettis Global, Profit, AGBI, Gulf News, Reuters, CNBC, Washington "
        "Post, Trading Economics, Advisor Perspectives, Kitco, JM Bullion, SBP).\n"
        "- Never invent a level. Tag every figure V (verified) or EST. (desk estimate) in the "
        "snapshot 'tag' fields and inline in prose.\n"
        "- Cover: KSE-100 close (pts & %), volume, breadth, movers, sector leaders/laggards; US "
        "indices + 10Y/2Y + Fed stance; GCC (oil output/OPEC+, non-oil PMI, PIF/Vision 2030); "
        "gold, silver, WTI, Brent; USD/PKR interbank; SBP rate, CPI, KIBOR, IMF; and a 3-row "
        "legislative tracker (Pakistan / GCC / Global) with who-wins/who-loses.\n"
        "- House voice: tight, analytical, justified prose. Inline links use real verified source "
        "URLs as <a href=\"URL\">text</a>. Use HTML entities (&amp; for &).\n"
        "- WORK EFFICIENTLY: aim for ~12-16 web searches total; two credible sources per key figure "
        "is enough — do not exhaust every source. As soon as you have the numbers, WRITE "
        "scripts/economic_vibes/out/payload.json and STOP. Do not re-verify endlessly.\n\n"
        f"Use these exact identifiers: date_long='{dates['date_long']}', "
        f"iso_date='{dates['iso_date']}', pdf_filename='{dates['pdf_filename']}', "
        f"date_news='{dates['date_news']}'.\n\n"
        f"JSON schema (fill EVERY field; 6 snapshot cards, 5 five_things, 3 legislative rows):\n"
        f"{_JSON_SCHEMA_HINT}\n"
    )


def emit_prompt() -> None:
    dates = compute_dates()
    DATES_FILE.write_text(json.dumps(dates, indent=2), encoding="utf-8")
    PROMPT_FILE.write_text(build_prompt(dates), encoding="utf-8")
    print(f"Prompt -> {PROMPT_FILE}")
    print(f"Dates  -> {DATES_FILE} ({dates['date_long']}, last close {dates['last_close_long']})")


# ------------------------------------------------------------- payload load / SDK path
def load_payload_from_file() -> dict:
    if not PAYLOAD_FILE.exists():
        sys.exit(f"{PAYLOAD_FILE} not found — did the Claude Code research step run?")
    dates = json.loads(DATES_FILE.read_text(encoding="utf-8")) if DATES_FILE.exists() else compute_dates()
    payload = _extract_json(PAYLOAD_FILE.read_text(encoding="utf-8"))
    _validate(payload)
    payload.update(dates)
    _ensure_disclaimer(payload)
    return payload


def research_payload_via_sdk(dates: dict) -> dict:
    """Fallback: call the Anthropic API directly (uses Console credits)."""
    try:
        import anthropic
    except ImportError:
        sys.exit("anthropic SDK not installed — see requirements.txt")
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("No payload file and ANTHROPIC_API_KEY unset. Use the Claude Code path "
                 "(emit-prompt -> claude -> render) or set ANTHROPIC_API_KEY.")
    model = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5")
    client = anthropic.Anthropic(api_key=api_key)
    resp = client.messages.create(
        model=model, max_tokens=8000,
        system="Return ONLY one fenced ```json block matching the requested schema.",
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 12}],
        messages=[{"role": "user", "content": build_prompt(dates)}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    payload = _extract_json(text)
    _validate(payload)
    payload.update(dates)
    _ensure_disclaimer(payload)
    return payload


def _extract_json(text: str) -> dict:
    m = re.search(r"```json\s*(.+?)\s*```", text, re.DOTALL)
    raw = m.group(1) if m else text
    if not m:
        b, e = raw.find("{"), raw.rfind("}")
        if b >= 0 and e > b:
            raw = raw[b : e + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        (OUT / "last_model_output.txt").write_text(text, encoding="utf-8")
        sys.exit(f"Could not parse JSON ({exc}). Raw saved to out/last_model_output.txt")


REQUIRED_KEYS = [
    "headline", "mood", "mood_class", "snapshot", "five_things", "matrix",
    "legislative", "levels", "desk_stance_html", "ticker_items", "news_items",
    "linkedin_text", "whatsapp_caption", "sources",
]


def _validate(p: dict) -> None:
    missing = [k for k in REQUIRED_KEYS if k not in p]
    if missing:
        (OUT / "last_payload.json").write_text(json.dumps(p, indent=2), encoding="utf-8")
        sys.exit(f"Payload missing keys: {missing} (saved out/last_payload.json)")
    if len(p["snapshot"]) != 6:
        sys.exit(f"Expected 6 snapshot cards, got {len(p['snapshot'])}")
    if len(p["five_things"]) != 5:
        sys.exit(f"Expected 5 five_things, got {len(p['five_things'])}")
    if len(p["legislative"]) != 3:
        sys.exit(f"Expected 3 legislative rows, got {len(p['legislative'])}")


def _ensure_disclaimer(p: dict) -> None:
    tail = "responsible for your trading decisions"
    for key in ("linkedin_text", "whatsapp_caption"):
        if tail not in p.get(key, ""):
            p[key] = p.get(key, "").rstrip() + "\n\n" + DISCLAIMER
    p["disclaimer"] = DISCLAIMER


# ----------------------------------------------------------------------------- render
def render(payload: dict) -> None:
    from jinja2 import Environment, FileSystemLoader

    env = Environment(loader=FileSystemLoader(str(SCRIPT_DIR)), autoescape=False)  # HTML fields trusted

    brief_html = env.get_template("template_brief.html.j2").render(**payload)
    brief_path = PUBLIC / payload["brief_html_filename"]
    brief_path.write_text(brief_html, encoding="utf-8")
    _integrity_check(brief_html)
    _render_pdf(brief_path, PUBLIC / payload["pdf_filename"])
    _maybe_docx(brief_path, PUBLIC / payload["docx_filename"])

    page_html = env.get_template("template_page.html.j2").render(**payload)
    _integrity_check(page_html)
    (PUBLIC / "economic-vibes.html").write_text(page_html, encoding="utf-8")

    _update_index(payload)
    _bump_sitemap(payload["iso_date"])

    (OUT / "linkedin.txt").write_text(payload["linkedin_text"], encoding="utf-8")
    (OUT / "whatsapp.txt").write_text(payload["whatsapp_caption"], encoding="utf-8")
    (OUT / "meta.json").write_text(
        json.dumps({"pdf": payload["pdf_filename"], "iso_date": payload["iso_date"]}, indent=2),
        encoding="utf-8",
    )
    (OUT / "last_payload.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("Render complete. Files written to public/ and scripts/economic_vibes/out/.")


def _integrity_check(html: str) -> None:
    if html.count("responsible for your trading decisions") < 1:
        sys.exit("Integrity check failed: disclaimer missing from rendered HTML.")
    if re.search(r"wealth\s*street", html, re.IGNORECASE):
        sys.exit("Integrity check failed: forbidden phrase 'Wealth Street' present.")


def _render_pdf(html_path: Path, pdf_path: Path) -> None:
    from weasyprint import HTML
    HTML(filename=str(html_path), base_url=str(PUBLIC)).write_pdf(str(pdf_path))
    print(f"PDF -> {pdf_path.name} ({pdf_path.stat().st_size} bytes)")


def _maybe_docx(html_path: Path, docx_path: Path) -> None:
    try:
        subprocess.run(["pandoc", str(html_path), "-o", str(docx_path), "--self-contained"],
                       check=True, capture_output=True)
        print(f"DOCX -> {docx_path.name}")
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        print(f"DOCX skipped ({exc}).")


def _ticker_block(items: list[str]) -> str:
    sep = '<span class="ev-ticker__sep">•</span>\n        '
    return sep.join(items) + sep.rstrip()


def _update_index(payload: dict) -> None:
    idx = PUBLIC / "index.html"
    html = idx.read_text(encoding="utf-8")
    data_inner = "\n        " + _ticker_block(payload["ticker_items"]) + "\n"
    news_inner = "\n        " + _ticker_block(payload["news_items"]) + "\n"
    html = _replace_marker_track(html, "EV-DATA", data_inner)
    html = _replace_marker_track(html, "EV-NEWS", news_inner)
    idx.write_text(html, encoding="utf-8")
    print("index.html tickers updated.")


def _replace_marker_track(html: str, marker: str, inner: str) -> str:
    start = re.search(rf"<!--\s*{marker}:START.*?-->", html)
    end = re.search(rf"<!--\s*{marker}:END\s*-->", html)
    if not start or not end:
        sys.exit(f"Marker {marker} not found in index.html")
    block = (
        html[start.start(): start.end()]
        + "\n    <span class=\"ev-ticker__track\">\n"
        + f"      <span class=\"ev-ticker__item\">{inner}      </span>\n"
        + f"      <span class=\"ev-ticker__item\" aria-hidden=\"true\">{inner}      </span>\n"
        + "    </span>\n    "
        + html[end.start(): end.end()]
    )
    return html[: start.start()] + block + html[end.end():]


def _bump_sitemap(iso_date: str) -> None:
    sm = PUBLIC / "sitemap.xml"
    txt = sm.read_text(encoding="utf-8")
    new = re.sub(
        r"(<loc>https://contexai\.org/economic-vibes</loc><lastmod>)\d{4}-\d{2}-\d{2}(</lastmod>)",
        rf"\g<1>{iso_date}\g<2>", txt,
    )
    if new != txt:
        sm.write_text(new, encoding="utf-8")
        print(f"sitemap lastmod -> {iso_date}")
    else:
        print("sitemap: economic-vibes line not found / unchanged.")


# --------------------------------------------------------------------- schema string
_JSON_SCHEMA_HINT = r"""
{
  "headline": "one-line web hero headline, no markup",
  "mood": "short mood phrase e.g. 'Cautiously constructive · oil the swing factor'",
  "mood_class": "up | dn",
  "snapshot": [
    {"label":"KSE-100","tag":"V","value":"176,094","delta":"▲ 0.31% Fri · +546 pts","delta_class":"pos"},
    {"label":"S&amp;P 500","tag":"V","value":"▲ 0.7%","delta":"Nasdaq +1.0% · Dow +0.53%","delta_class":"pos"},
    {"label":"US 10Y / 2Y","tag":"V","value":"4.75 / 4.28","delta":"hawkish hold","delta_class":"neg"},
    {"label":"Brent / WTI","tag":"V","value":"$88.5 / $85.0","delta":"July +20% · Hormuz","delta_class":"pos"},
    {"label":"Gold","tag":"V","value":"$4,054","delta":"−1% · silver $58.26","delta_class":"neg"},
    {"label":"USD/PKR","tag":"V","value":"278.00","delta":"interbank · steady","delta_class":""}
  ],
  "five_things": [
    {"chip":"Short Label","html":"Sentence(s) with <b>bold</b> and <a href=\"URL\">source</a>.","sentiment":"cautiously firmer","sentiment_class":"pos"}
  ],
  "matrix": {
    "local_html":"Pakistan focus paragraph with <b> and <a>.",
    "gcc_html":"GCC & Middle East paragraph.",
    "global_html":"Global intelligence paragraph."
  },
  "legislative": [
    {"jur":"Local — Pakistan","policy_html":"<a href=\"URL\">Policy</a> — detail","sectors":"Banks, Equities","impact_html":"<b class=\"pos\">Wins:</b> ... <b class=\"neg\">Loses:</b> ..."}
  ],
  "levels": {"support":"175,000","support_note":"first floor; deeper support at 173,500","pivot":"176,094","pivot_note":"Friday's close","resistance":"177,100","resistance_note":"Friday's intraday high; then 177,700"},
  "desk_stance_html":"Desk stance paragraph with <b>; end 'All levels are indicative desk estimates, not recommendations.'",
  "ticker_items":["<b>MON 03 AUG 2026 · LAST CLOSE FRI 31 JUL</b>","KSE-100 176,094 <span class=\"up\">▲ 0.31%</span> (+546) Fri close","...more segments S&P/Dow/Nasdaq/10Y/Brent/WTI/Gold/USD-PKR/SBP/Mood...","<b>Read today's Morning Brief →</b>"],
  "news_items":["<b>03 AUG 2026</b>","📈 headline 1","🛢️ headline 2","...8-9 total Pakistan/GCC/Global headlines...","<b>More on contexai.org/insights →</b>"],
  "linkedin_text":"Full-length post: hook, THE OVERNIGHT TAPE, PAKISTAN, GCC, GLOBAL, LEGISLATIVE TRACKER, THE DAY AHEAD (KSE-100 support/pivot/resistance + stance), 'Full brief → contexai.org/economic-vibes', hashtags #EconomicVibes #ContexAiGroup #PSX #KSE100 #GCC #MarketBrief, then the disclaimer. Plain text with \n; no markdown.",
  "whatsapp_caption":"Emoji WhatsApp Channel caption noting the attached PDF, ending with the disclaimer.",
  "sources":[{"title":"Source name","url":"https://..."}]
}
""".strip()


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "sdk"
    if mode == "emit-prompt":
        emit_prompt()
    elif mode == "render":
        render(load_payload_from_file())
    elif mode == "sdk":
        dates = compute_dates()
        print(f"[SDK mode] Building for {dates['date_long']}")
        render(research_payload_via_sdk(dates))
    else:
        sys.exit(f"Unknown mode '{mode}'. Use: emit-prompt | render | (none=sdk).")


if __name__ == "__main__":
    main()
