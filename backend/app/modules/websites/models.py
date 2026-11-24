from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, IdMixin, TimestampMixin, utcnow


class Website(IdMixin, TimestampMixin, Base):
    __tablename__ = "websites"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="unknown", nullable=False)  # unknown|up|degraded|down
    last_status_code: Mapped[int | None] = mapped_column(Integer)
    last_response_ms: Mapped[int | None] = mapped_column(Integer)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class WebsiteHealthCheck(Base):
    __tablename__ = "website_health_checks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    website_id: Mapped[str] = mapped_column(ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    status_code: Mapped[int | None] = mapped_column(Integer)
    response_ms: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(String(300))
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
