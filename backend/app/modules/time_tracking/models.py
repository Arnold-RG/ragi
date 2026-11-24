from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, IdMixin, TimestampMixin


class TimeEntry(IdMixin, TimestampMixin, Base):
    __tablename__ = "time_entries"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), index=True)
    note: Mapped[str | None] = mapped_column(String(500))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    billable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    billing_handoff_id: Mapped[str | None] = mapped_column(ForeignKey("billing_handoffs.id", ondelete="SET NULL"), index=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
