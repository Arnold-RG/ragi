from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.core.permissions import Perm
from app.integrations.omh.client import finance_summary
from app.integrations.providers.base import provider_status
from app.modules.identity.deps import require

router = APIRouter(tags=["integrations"])


@router.get("/finance-summary")
def finance(_=Depends(require(Perm.READ))):
    """Read-only finance summary from OMH (the financial authority)."""
    return finance_summary()


@router.get("/integrations")
def integrations(_=Depends(require(Perm.READ))):
    s = get_settings()
    items = [
        {"id": "omh", "name": "Our Money Hub", "kind": "ecosystem", "connected": bool(s.omh_api_url),
         "detail": "Budgets, AI spend and invoices" if s.omh_api_url else "OMH_API_URL not set"},
        {"id": "openai", "name": "OpenAI", "kind": "ai-provider", "connected": provider_status("openai").configured,
         "detail": provider_status("openai").detail},
        {"id": "xai", "name": "Grok / xAI", "kind": "ai-provider", "connected": provider_status("xai").configured,
         "detail": provider_status("xai").detail},
        {"id": "github", "name": "GitHub App", "kind": "repositories", "connected": bool(s.github_app_id),
         "detail": "Read-only repository monitoring" if s.github_app_id else "GITHUB_APP_ID not set"},
        {"id": "oidc", "name": "OpenID Connect", "kind": "identity", "connected": bool(s.oidc_issuer_url),
         "detail": "Single sign-on" if s.oidc_issuer_url else "Local password + TOTP in use"},
        {"id": "object-storage", "name": "S3-compatible storage", "kind": "files", "connected": bool(s.object_storage_endpoint),
         "detail": "Project artifacts" if s.object_storage_endpoint else "OBJECT_STORAGE_ENDPOINT not set"},
    ]
    return {"items": items}
