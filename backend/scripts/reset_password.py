#!/usr/bin/env python3
"""Owner-run password reset. There is no email provider (decision D4).

Usage (from backend/):
  python -m scripts.reset_password user@example.com
The new password is read from the prompt or from --password-file (never from argv).
"""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

# Allow running as a script from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from app.core.passwords import validate_password  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database.session import SessionLocal  # noqa: E402
from app.modules.identity.models import User  # noqa: E402
from app.modules.identity.service import revoke_all_other  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset a RAGI user's password (owner CLI).")
    parser.add_argument("email")
    parser.add_argument("--password-file", type=Path, help="Read the new password from this file")
    args = parser.parse_args()
    if args.password_file:
        password = args.password_file.read_text().strip()
    else:
        password = getpass.getpass("New password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match", file=sys.stderr)
            return 1
    try:
        validate_password(password, email=args.email)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(func.lower(User.email) == args.email.strip().lower()))
        if not user:
            # Do not reveal whether the address exists in logs that might be shared;
            # still exit non-zero so the operator knows the reset did not apply.
            print("No matching account (or the reset could not be applied).", file=sys.stderr)
            return 2
        user.password_hash = hash_password(password)
        user.failed_logins = 0
        user.locked_until = None
        revoked = revoke_all_other(db, user.id)
        db.commit()
        print(f"Password updated. {revoked} other session(s) signed out.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
