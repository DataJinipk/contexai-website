#!/usr/bin/env python3
"""
Quiet success ping for the Economic Vibes pipeline.

Runs on a successful run (wired to `if: success()`) and posts a one-line
"posted ✅ + link" to the SAME Slack webhook used for failure alerts. Standard-library
only; a no-op if SLACK_WEBHOOK_URL isn't set. Never fails the job (always exits 0).

Env:
  SLACK_WEBHOOK_URL   Slack Incoming Webhook (same channel as failure alerts)
  PUBLIC_PDF_BASE_URL e.g. https://contexai.org
  LINKEDIN_RESULT     optional status string surfaced by the LinkedIn step
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent / "out"


def main() -> None:
    url = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    if not url:
        print("Slack: not configured, skipping success ping.")
        return

    base = os.environ.get("PUBLIC_PDF_BASE_URL", "https://contexai.org").rstrip("/")
    meta = {}
    if (OUT / "meta.json").exists():
        meta = json.loads((OUT / "meta.json").read_text(encoding="utf-8"))
    pdf = meta.get("pdf", "")
    iso = meta.get("iso_date", "")

    # posting outcomes (best-effort; files only exist if those steps ran/succeeded)
    li = (OUT / "linkedin_result.txt").read_text(encoding="utf-8").strip() if (OUT / "linkedin_result.txt").exists() else "not run/failed"

    lines = [
        f"✅ *Economic Vibes* posted — {iso or 'today'}",
        f"Page: {base}/economic-vibes",
    ]
    if pdf:
        lines.append(f"PDF: {base}/{pdf}")
    lines.append(f"LinkedIn: {li}")

    payload = json.dumps({"text": "\n".join(lines)}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"Slack success ping sent ({r.status}).")
    except Exception as exc:  # never fail the job on a notifier error
        print(f"Slack success ping failed ({exc}).")


if __name__ == "__main__":
    main()
