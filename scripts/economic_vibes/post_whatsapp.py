#!/usr/bin/env python3
"""
Deliver the day's Economic Vibes caption + PDF via the WhatsApp Cloud API.

IMPORTANT — read this before relying on it:
  WhatsApp *Channels* have NO official public posting API from Meta. You cannot
  programmatically publish to a WhatsApp Channel. This script therefore delivers
  the caption + PDF to a configured recipient/broadcast number via the WhatsApp
  Cloud API (business number). Common patterns:
    - send to your own admin number, then forward into the Channel by hand, or
    - send to opted-in subscribers, or
    - swap in a third-party Channel provider (360dialog / Whapi) by editing send().
  The caption + PDF are always written to out/whatsapp.txt and public/ so a human
  can post them even if no API path is configured.

Env / secrets:
  WHATSAPP_TOKEN       — Cloud API access token
  WHATSAPP_PHONE_ID    — Cloud API phone-number id (sender)
  WHATSAPP_TO          — recipient in E.164 (e.g. 9231XXXXXXXX) — admin or broadcast
  PUBLIC_PDF_BASE_URL  — e.g. https://contexai.org  (for the public PDF link)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent / "out"


def main() -> None:
    token = os.environ.get("WHATSAPP_TOKEN")
    phone_id = os.environ.get("WHATSAPP_PHONE_ID")
    to = os.environ.get("WHATSAPP_TO")
    base = os.environ.get("PUBLIC_PDF_BASE_URL", "https://contexai.org").rstrip("/")

    caption = (OUT / "whatsapp.txt").read_text(encoding="utf-8").strip() if (OUT / "whatsapp.txt").exists() else ""
    meta = json.loads((OUT / "meta.json").read_text(encoding="utf-8")) if (OUT / "meta.json").exists() else {}
    pdf_name = meta.get("pdf", "")
    pdf_url = f"{base}/{pdf_name}" if pdf_name else ""

    if not (token and phone_id and to):
        print(
            "WhatsApp not fully configured (need WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TO). "
            "Caption + PDF are available in out/whatsapp.txt and " + (pdf_url or "public/") +
            " for manual posting to the Channel."
        )
        return

    api = f"https://graph.facebook.com/v20.0/{phone_id}/messages"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # 1) caption as a text message
    r1 = requests.post(
        api, headers=headers,
        json={"messaging_product": "whatsapp", "to": to, "type": "text",
              "text": {"preview_url": True, "body": caption}},
        timeout=45,
    )
    # 2) the PDF as a document (by public link)
    r2 = None
    if pdf_url:
        r2 = requests.post(
            api, headers=headers,
            json={"messaging_product": "whatsapp", "to": to, "type": "document",
                  "document": {"link": pdf_url, "filename": pdf_name,
                               "caption": "Economic Vibes — Morning Brief"}},
            timeout=45,
        )

    ok = r1.status_code == 200 and (r2 is None or r2.status_code == 200)
    if ok:
        print("WhatsApp delivered (text" + (" + PDF" if r2 is not None else "") + ").")
    else:
        detail = f"text={r1.status_code}:{r1.text[:400]}"
        if r2 is not None:
            detail += f" | doc={r2.status_code}:{r2.text[:400]}"
        sys.exit(f"WhatsApp send FAILED: {detail}")


if __name__ == "__main__":
    main()
