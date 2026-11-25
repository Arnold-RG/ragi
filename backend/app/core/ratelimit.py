"""Shared-storage rate limiter (SQLite or Postgres). Survives worker restarts."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import DateTime, Integer, String, delete, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.database.base import Base, IdMixin


class RateLimitEvent(IdMixin, Base):
    __tablename__ = "rate_limit_events"
    bucket: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


class AuthBackoff(Base):
    """Growing delay keyed on a normalised email (existing and unknown alike)."""
    __tablename__ = "auth_backoffs"
    key: Mapped[str] = mapped_column(String(320), primary_key=True)
    failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delay_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


def hit(db: Session, key: str, limit: int, window_seconds: int,
        *, now: datetime | None = None) -> tuple[bool, int]:
    """Record a hit. Returns (allowed, retry_after_seconds)."""
    now = now or datetime.now(UTC)
    start = now - timedelta(seconds=window_seconds)
    db.execute(delete(RateLimitEvent).where(
        RateLimitEvent.bucket == key, RateLimitEvent.created_at < start))
    count = db.scalar(select(func.count()).select_from(RateLimitEvent).where(
        RateLimitEvent.bucket == key, RateLimitEvent.created_at >= start)) or 0
    if count >= limit:
        oldest = db.scalar(select(func.min(RateLimitEvent.created_at)).where(
            RateLimitEvent.bucket == key, RateLimitEvent.created_at >= start))
        retry = window_seconds
        if oldest is not None:
            delta = (oldest + timedelta(seconds=window_seconds)) - now
            retry = max(1, int(delta.total_seconds()))
        return False, retry
    db.add(RateLimitEvent(bucket=key, created_at=now))
    db.flush()
    return True, 0


def backoff_state(db: Session, key: str, *, now: datetime | None = None) -> tuple[bool, int]:
    """Return (blocked, retry_after). Unknown and known emails share this table."""
    now = now or datetime.now(UTC)
    row = db.get(AuthBackoff, key)
    if not row or not row.delay_until:
        return False, 0
    until = row.delay_until if row.delay_until.tzinfo else row.delay_until.replace(tzinfo=UTC)
    if until <= now:
        return False, 0
    return True, max(1, int((until - now).total_seconds()))


def record_failure(db: Session, key: str, *, now: datetime | None = None,
                   after: int = 5, cap_minutes: int = 15) -> tuple[bool, int]:
    """Increment failures. After ``after`` failures, impose 1, 2, 4, 8… minutes (capped)."""
    now = now or datetime.now(UTC)
    row = db.get(AuthBackoff, key)
    if not row:
        row = AuthBackoff(key=key, failures=0, delay_until=None, updated_at=now)
        db.add(row)
        db.flush()
    row.failures = (row.failures or 0) + 1
    row.updated_at = now
    if row.failures >= after:
        # 1, 2, 4, 8… minutes starting at the 5th failure.
        steps = row.failures - after
        minutes = min(cap_minutes, 1 << min(steps, 10))
        row.delay_until = now + timedelta(minutes=minutes)
        db.flush()
        return True, minutes * 60
    db.flush()
    return False, 0


def clear_backoff(db: Session, key: str) -> None:
    row = db.get(AuthBackoff, key)
    if row:
        db.delete(row)
        db.flush()
