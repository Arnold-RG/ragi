#!/usr/bin/env python3
"""Create a one-time RAGI invite and write the link to a 0600 file (never email)."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# scripts/ is inside the backend package tree
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    p = argparse.ArgumentParser(description="Create a 72-hour, single-use RAGI invite.")
    p.add_argument("--email", required=True)
    p.add_argument("--role", default="viewer", choices=["viewer", "operator", "admin"])
    p.add_argument("--created-by", default=None, help="User id of the owner/admin issuing the invite")
    p.add_argument("--out", required=True, help="Path to write the invite link (mode 0600)")
    args = p.parse_args()

    from app.core.config import get_settings
    from app.database.session import SessionLocal
    from app.modules.identity import invites

    out = Path(args.out)
    db = SessionLocal()
    try:
        raw = invites.issue(db, email=args.email, role=args.role, created_by=args.created_by)
        db.commit()
    finally:
        db.close()
    base = get_settings().public_base_url.rstrip("/")
    url = f"{base}/invite#{raw}"
    out.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(url + "\n")
    os.chmod(out, 0o600)
    print(f"Invite written to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
