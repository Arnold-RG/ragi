"""RAGI v2 API — operations engine of the Arnova Group ecosystem.

Created by Arnold Rurangwa / Arnova Group.
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.money import MoneyError
from app.database import models  # noqa: F401  (register all tables)
from app.database.session import SessionLocal
from app.modules.audit.models import AuditLog
from app.modules.identity.deps import load_session

configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Start optional in-process loops (outbox delivery, GitHub sync). Off in tests."""
    tasks: list[asyncio.Task] = []
    if settings.app_env not in {"test"}:
        from app.events.delivery import configured as delivery_configured, delivery_loop
        from app.integrations.github.loop import github_sync_loop
        if delivery_configured() or settings.ecosystem_delivery_enabled:
            tasks.append(asyncio.create_task(delivery_loop()))
        if settings.github_sync_interval_hours and settings.github_sync_interval_hours > 0:
            tasks.append(asyncio.create_task(github_sync_loop()))
    yield
    for task in tasks:
        task.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(
    lifespan=lifespan,
    title="RAGI API",
    version="2.0.0-alpha.1",
    summary="Operations engine of the Arnova Group ecosystem — projects, tasks, clients, agents and approvals.",
    description="Created by Arnold Rurangwa / Arnova Group. Browser clients authenticate with an HttpOnly session "
                "cookie and must send `X-RAGI-Request: 1` on writes. Service-to-service events use HMAC signatures.",
    contact={"name": "Arnold Rurangwa / Arnova Group"},
    docs_url="/api/docs" if settings.api_docs_enabled else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.api_docs_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-RAGI-Request"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/docs"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(MoneyError)
async def money_error(_: Request, exc: MoneyError):
    return JSONResponse({"detail": str(exc)}, status_code=422)


app.include_router(api_router)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok"}


def _ws_auth(token: str | None) -> str | None:
    """Return the organisation id for a live, fully verified session (re-checked on every poll)."""
    with SessionLocal() as db:
        found = load_session(db, token)
        if not found or found[0].mfa_pending or found[0].enrolment_required:
            return None
        return found[1].organization_id


def _ws_last_id() -> int:
    with SessionLocal() as db:
        return db.scalar(select(AuditLog.id).order_by(AuditLog.id.desc()).limit(1)) or 0


def _ws_poll(org_id: str, last_id: int) -> list[dict]:
    with SessionLocal() as db:
        rows = db.scalars(select(AuditLog).where(AuditLog.id > last_id, AuditLog.organization_id == org_id)
                          .order_by(AuditLog.id).limit(50)).all()
        return [{"id": r.id, "actor": r.actor_label, "action": r.action, "summary": r.summary,
                 "at": r.created_at.isoformat()} for r in rows]


@app.websocket("/ws/operations")
async def operations_feed(ws: WebSocket):
    """Live activity feed: pushes new audit entries (recorded events only).

    Origin is checked (cross-site WebSocket hijacking), the session is re-validated on every
    poll (a revoked session stops streaming), and DB work runs off the event loop."""
    if ws.headers.get("origin") not in settings.cors_origins:
        await ws.close(code=4403)
        return
    token = ws.cookies.get(settings.session_cookie_name) or ws.cookies.get(getattr(settings, 'session_cookie_legacy_name', 'ragi_session'))
    org_id = await run_in_threadpool(_ws_auth, token)
    if not org_id:
        await ws.close(code=4401)
        return
    await ws.accept()
    last_id = await run_in_threadpool(_ws_last_id)
    try:
        while True:
            if await run_in_threadpool(_ws_auth, token) != org_id:
                await ws.close(code=4401)
                return
            for item in await run_in_threadpool(_ws_poll, org_id, last_id):
                last_id = item["id"]
                if not item["action"].startswith("auth."):
                    await ws.send_json(item)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
