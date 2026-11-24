from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, IdMixin, TimestampMixin


class Approval(IdMixin, TimestampMixin, Base):
    """Owner decisions. Only the owner role can decide (agents' approvals don't count)."""

    __tablename__ = "approvals"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)  # agent_run | publish | deploy | deletion | spend
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    subject_type: Mapped[str | None] = mapped_column(String(40))
    subject_id: Mapped[str | None] = mapped_column(String(64))
    requested_by: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    decided_by: Mapped[str | None] = mapped_column(String(200))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(Text)
    context: Mapped[dict | None] = mapped_column(JSON)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
