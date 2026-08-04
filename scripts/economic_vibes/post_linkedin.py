#!/usr/bin/env python3
"""
Post the day's Economic Vibes brief to the ContexAi Group LinkedIn Company Page.

Reads the post text from out/linkedin.txt (written by build_brief.py) and publishes
a text share to the organization via the LinkedIn UGC Posts API.

Env / secrets required:
  LINKEDIN_ACCESS_TOKEN  — OAuth token for a page admin, scope: w_organization_social
  LINKEDIN_ORG_ID        — numeric org id (default 131244052 = ContexAi Group)

Behaviour:
  - Missing token/text  -> soft skip (exit 0), so a not-yet-configured secret never
    fails the deploy.
  - API error           -> hard fail (exit 1), surfaced in the Actions log.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent / "out"


def main() -> None:
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    org_id = os.environ.get("LINKEDIN_ORG_ID", "131244052")
    text_path = OUT / "linkedin.txt"

    if not token:
        print("LINKEDIN_ACCESS_TOKEN not set — skipping LinkedIn post (configure the secret to enable).")
        return
    if not text_path.exists():
        print("out/linkedin.txt missing — nothing to post.")
        return

    text = text_path.read_text(encoding="utf-8").strip()
    if not text:
        print("LinkedIn text empty — skipping.")
        return

    author = f"urn:li:organization:{org_id}"
    body = {
        "author": author,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
    }

    r = requests.post(
        "https://api.linkedin.com/v2/ugcPosts", headers=headers, json=body, timeout=45
    )
    if r.status_code in (200, 201):
        post_id = r.headers.get("x-restli-id") or r.json().get("id", "?")
        print(f"LinkedIn post published: {post_id}")
        (OUT / "linkedin_result.txt").write_text(
            f"OK {r.status_code} id={post_id}", encoding="utf-8"
        )
    else:
        sys.exit(f"LinkedIn post FAILED {r.status_code}: {r.text[:800]}")


if __name__ == "__main__":
    main()
