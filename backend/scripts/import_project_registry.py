"""Idempotent Arnold-RG project registry import. Dry-run by default.

Usage (from backend/):
  uv run python -m scripts.import_project_registry
  uv run python -m scripts.import_project_registry --apply
  uv run python -m scripts.import_project_registry --apply --include-private

Does not talk to the GitHub API. Private repos are skipped unless --include-private.
Kingdom Life is never modified. Never prints secrets.
"""
from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy import select

from app.database import models  # noqa: F401
from app.database.session import SessionLocal
from app.modules.identity.models import Organization
from app.modules.projects import registry


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Import the Arnold-RG project registry into RAGI.")
    ap.add_argument("--apply", action="store_true", help="Write changes. Without this flag, only print the plan.")
    ap.add_argument("--include-private", action="store_true",
                    help="Also upsert private repos (office server and archived fork). Off by default.")
    ap.add_argument("--org-slug", default=os.environ.get("RAGI_ORG_SLUG", "arnovagroup"))
    args = ap.parse_args(argv)

    db = SessionLocal()
    try:
        org = db.scalar(select(Organization).where(Organization.slug == args.org_slug))
        if not org:
            print(f"No organization with slug {args.org_slug!r}. Create the owner account first.", file=sys.stderr)
            return 2
        rows = registry.plan(db, org.id, include_private=args.include_private)
        print(registry.format_plan(rows))
        counts: dict[str, int] = {}
        for r in rows:
            counts[r["action"]] = counts.get(r["action"], 0) + 1
        print("Totals: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
        if not args.apply:
            print("Dry run only. Re-run with --apply to write these changes.")
            return 0
        registry.apply(db, org.id, include_private=args.include_private)
        db.commit()
        print("Applied.")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
