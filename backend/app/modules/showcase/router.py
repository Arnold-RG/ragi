"""Private gallery of live Arnold-RG sites and demos. Auth required."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.identity.deps import require
from app.modules.showcase.catalog import build_showcase

router = APIRouter(prefix="/showcase", tags=["showcase"])
_DATA = Path(__file__).with_name("sites.json")


def load_catalog() -> dict:
    return json.loads(_DATA.read_text())


def frame_origins() -> list[str]:
    origins = set()
    for site in load_catalog()["sites"]:
        if not site.get("embeddable"):
            continue
        for key in ("live_url", "final_url"):
            url = site.get(key)
            if not url:
                continue
            p = urlparse(url)
            if p.scheme and p.netloc:
                origins.add(f"{p.scheme}://{p.netloc}")
    return sorted(origins)


@router.get("/sites")
def list_sites(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    data = build_showcase(db, user.organization_id) or load_catalog()
    sites = data["sites"]
    groups: dict[str, int] = {}
    for s in sites:
        groups[s.get("group") or "Other"] = groups.get(s.get("group") or "Other", 0) + 1
    return {
        "title": "Showcase",
        "subtitle": f"{len(sites)} live sites · Arnold-RG",
        "generated_at": data.get("generated_at"),
        "checked_at_local": data.get("checked_at_local"),
        "summary": {**data.get("summary", {}), "groups": groups, "client_demos": 0},
        "sites": sites,
        "client_demos": [],
        "source": data.get("source") or "sites.json",
    }
