"""Optional in-process GitHub sync every N hours (GITHUB_SYNC_INTERVAL_HOURS)."""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.database.session import SessionLocal
from app.integrations.github import sync as github_sync
from app.modules.identity.models import Organization

log = logging.getLogger(__name__)


async def github_sync_loop() -> None:
    while True:
        hours = get_settings().github_sync_interval_hours
        wait = max(hours, 0.25) * 3600 if hours and hours > 0 else 3600
        try:
            if get_settings().app_env not in {"test"} and github_sync.token_configured():
                def run():
                    db = SessionLocal()
                    try:
                        org = db.scalar(select(Organization).where(Organization.slug == "arnovagroup"))
                        if not org:
                            return
                        github_sync.sync(db, org.id)
                        db.commit()
                    except Exception:
                        db.rollback()
                        log.exception("Periodic GitHub sync failed")
                    finally:
                        db.close()
                await asyncio.to_thread(run)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Periodic GitHub sync cycle failed")
        await asyncio.sleep(wait)
