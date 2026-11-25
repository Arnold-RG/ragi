from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, IdMixin, TimestampMixin


class Project(IdMixin, TimestampMixin, Base):
    """Project registry entry (master spec §13 manifest)."""

    __tablename__ = "projects"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False, default="client-website")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="upcoming", index=True)
    priority: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    summary: Mapped[str | None] = mapped_column(Text)
    client_id: Mapped[str | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), index=True)
    retainer_id: Mapped[str | None] = mapped_column(ForeignKey("retainers.id", ondelete="SET NULL"), index=True)
    repo_provider: Mapped[str | None] = mapped_column(String(20))
    repo_owner: Mapped[str | None] = mapped_column(String(100))
    repo_name: Mapped[str | None] = mapped_column(String(100))
    production_url: Mapped[str | None] = mapped_column(String(500))
    staging_url: Mapped[str | None] = mapped_column(String(500))
    start_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    integrations: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    owner_approval_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    automatic_modification: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    kind: Mapped[str | None] = mapped_column(String(20))  # own_product | client
    visibility: Mapped[str | None] = mapped_column(String(20))  # public | private
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    repo_pushed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProjectMilestone(IdMixin, TimestampMixin, Base):
    __tablename__ = "project_milestones"
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
