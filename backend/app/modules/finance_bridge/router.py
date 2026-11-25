from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.permissions import Perm
from app.database.session import get_db
from app.integrations.github import sync as github_sync
from app.integrations.providers.base import provider_status
from app.modules.identity.deps import require
from app.modules.projects import registry

router = APIRouter(tags=["integrations"])


def _is_owner(user) -> bool:
    return user.role == "owner"


@router.get("/integrations")
def integrations(_=Depends(require(Perm.READ))):
    """Only services that are actually configured. Unset integrations stay off the Connections panel."""
    s = get_settings()
    candidates = [
        {"id": "openai", "name": "OpenAI", "kind": "ai-provider", "connected": provider_status("openai").configured,
         "detail": provider_status("openai").detail},
        {"id": "xai", "name": "Grok / xAI", "kind": "ai-provider", "connected": provider_status("xai").configured,
         "detail": provider_status("xai").detail},
        {"id": "github", "name": "GitHub App", "kind": "repositories", "connected": bool(s.github_app_id),
         "detail": "Read-only repository monitoring" if s.github_app_id else "GITHUB_APP_ID not set"},
        {"id": "github-sync", "name": "GitHub project sync", "kind": "repositories",
         "connected": github_sync.token_configured(),
         "detail": "Read-only sync of Arnold-RG repositories" if github_sync.token_configured()
         else "GITHUB_SYNC_TOKEN is not set"},
        {"id": "object-storage", "name": "S3-compatible storage", "kind": "files", "connected": bool(s.object_storage_endpoint),
         "detail": "Project artifacts" if s.object_storage_endpoint else "OBJECT_STORAGE_ENDPOINT not set"},
    ]
    return {"items": [i for i in candidates if i["connected"]]}


@router.get("/integrations/github/sync")
def github_sync_status(db: Session = Depends(get_db), _=Depends(require(Perm.READ))):
    return github_sync.status(db)


@router.post("/integrations/github/sync")
def github_sync_now(db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    if not _is_owner(user):
        raise HTTPException(403, "Only the owner can sync from GitHub")
    if not github_sync.token_configured():
        return {"ok": False, "configured": False,
                "detail": "GITHUB_SYNC_TOKEN is not set. Add a fine-grained read-only token on the API service, then try again."}
    try:
        result = github_sync.sync(db, user.organization_id)
        db.commit()
        return result
    except github_sync.SyncNotConfigured:
        github_sync.record_failure(db, "GITHUB_SYNC_TOKEN is not set")
        db.commit()
        return {"ok": False, "configured": False, "detail": "GITHUB_SYNC_TOKEN is not set"}
    except github_sync.SyncRateLimited as exc:
        github_sync.record_failure(db, str(exc))
        db.commit()
        raise HTTPException(429, str(exc)) from exc
    except Exception as exc:
        db.rollback()
        db2 = db
        try:
            github_sync.record_failure(db2, exc.__class__.__name__)
            db2.commit()
        except Exception:
            db2.rollback()
        raise HTTPException(502, "GitHub sync failed. Try again in a minute.") from exc


@router.get("/integrations/registry/plan")
def registry_plan(include_private: bool = False, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    if not _is_owner(user):
        raise HTTPException(403, "Only the owner can review the project registry")
    rows = registry.plan(db, user.organization_id, include_private=include_private)
    return {"items": rows, "text": registry.format_plan(rows)}


@router.post("/integrations/registry/apply")
def registry_apply(include_private: bool = False, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    if not _is_owner(user):
        raise HTTPException(403, "Only the owner can apply the project registry")
    rows = registry.apply(db, user.organization_id, include_private=include_private)
    db.commit()
    return {"ok": True, "items": rows, "text": registry.format_plan(rows)}

