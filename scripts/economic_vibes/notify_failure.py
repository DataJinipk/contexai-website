#!/usr/bin/env python3
"""
Lightweight failure alert for the Economic Vibes pipeline.

Runs ONLY on a failed workflow run (wired to `if: failure()`), and sends a short
message to Slack and/or email — whichever is configured. Standard-library only
(urllib + smtplib), so it works even if an earlier `pip install` step is what failed.
The notifier itself never fails the job (always exits 0).

Configured via env (all optional — each channel activates only if its vars are set):
  SLACK_WEBHOOK_URL                          Slack Incoming Webhook
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS SMTP relay for email
  ALERT_EMAIL_TO, ALERT_EMAIL_FROM           email addresses
  RUN_URL                                    link to the failed Actions run
"""
from __future__ import annotations

import json
import os
import smtplib
import ssl
import urllib.request
from email.message import EmailMessage

RUN_URL = os.environ.get("RUN_URL", "(run url unavailable)")
SUBJECT = "⚠️ Economic Vibes morning run FAILED"
BODY = (
    "The Economic Vibes autonomous pipeline failed this morning.\n\n"
    f"Failed run: {RUN_URL}\n\n"
    "Open the run log to see which step broke (research, render, push, or post). "
    "The live site was NOT updated for a hard failure; posting failures alone do not "
    "trigger this alert.\n\n— ContexAi automation"
)


def notify_slack() -> None:
    url = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    if not url:
        print("Slack: not configured, skipping.")
        return
    payload = json.dumps({"text": f"{SUBJECT}\n{RUN_URL}"}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"Slack: sent ({r.status}).")
    except Exception as exc:  # never fail the job on a notifier error
        print(f"Slack: send failed ({exc}).")


def notify_email() -> None:
    host = os.environ.get("SMTP_HOST", "").strip()
    to = os.environ.get("ALERT_EMAIL_TO", "").strip()
    user = os.environ.get("SMTP_USER", "").strip()
    pwd = os.environ.get("SMTP_PASS", "").strip()
    if not (host and to and user and pwd):
        print("Email: not fully configured, skipping.")
        return
    port = int(os.environ.get("SMTP_PORT", "587"))
    msg = EmailMessage()
    msg["Subject"] = SUBJECT
    msg["From"] = os.environ.get("ALERT_EMAIL_FROM", user)
    msg["To"] = to
    msg.set_content(BODY)
    try:
        ctx = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=30) as s:
                s.login(user, pwd)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls(context=ctx)
                s.login(user, pwd)
                s.send_message(msg)
        print(f"Email: sent to {to}.")
    except Exception as exc:
        print(f"Email: send failed ({exc}).")


if __name__ == "__main__":
    notify_slack()
    notify_email()
    print("Notifier done.")
