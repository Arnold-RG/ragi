from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.permissions import Perm
from app.integrations.providers.base import provider_status
from app.modules.identity.deps import require

router = APIRouter(tags=["integrations"])


@router.get("/integrations")
def integrations(_=Depends(require(Perm.READ))):
    s = get_settings()
    items = [
        {"id": "omh", "name": "Our Money Hub", "kind": "ecosystem",
         "connected": bool(s.omh_api_url and s.ecosystem_keyring_file),
         "detail": "Money lives in Our Money Hub. RAGI only hands work over."},
        {"id": "openai", "name": "OpenAI", "kind": "ai-provider", "connected": provider_status("openai").configured,
         "detail": provider_status("openai").detail},
        {"id": "xai", "name": "Grok / xAI", "kind": "ai-provider", "connected": provider_status("xai").configured,
         "detail": provider_status("xai").detail},
        {"id": "github", "name": "GitHub App", "kind": "repositories", "connected": bool(s.github_app_id),
         "detail": "Read-only repository monitoring" if s.github_app_id else "GITHUB_APP_ID not set"},
        {"id": "object-storage", "name": "S3-compatible storage", "kind": "files", "connected": bool(s.object_storage_endpoint),
         "detail": "Project artifacts" if s.object_storage_endpoint else "OBJECT_STORAGE_ENDPOINT not set"},
    ]
    return {"items": items}
