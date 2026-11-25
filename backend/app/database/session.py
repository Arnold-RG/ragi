from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_settings = get_settings()
_connect_args = {}
if _settings.is_sqlite:
    _connect_args["check_same_thread"] = False
elif "pooler" in (_settings.db_url or ""):
    # Neon pooler is PgBouncer in transaction mode; disable prepared statements.
    _connect_args["prepare_threshold"] = None
engine = create_engine(_settings.db_url, connect_args=_connect_args, pool_pre_ping=True)

if _settings.is_sqlite:
    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_conn, _):  # pragma: no cover - sqlite only
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
