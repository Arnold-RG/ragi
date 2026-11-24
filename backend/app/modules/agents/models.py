from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, IdMixin, TimestampMixin, utcnow


class Agent(IdMixin, TimestampMixin, Base):
    """AI agent profile, per organization. RAGI is the authority for agent profiles (spec §06)."""

    __tablename__ = "agents"
    __table_args__ = (UniqueConstraint("organization_id", "slug"),)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(40), nullable=False)  # e.g. "forge"
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    department: Mapped[str] = mapped_column(String(40), nullable=False)
    role: Mapped[str] = mapped_column(String(200), nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    placeholder: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    capabilities: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    permissions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    execution: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    financial_controls: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    governance: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class AgentRun(IdMixin, Base):
    __tablename__ = "agent_runs"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), nullable=False, index=True)
    capability: Mapped[str | None] = mapped_column(String(80))
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), index=True)
    requested_by: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # blocked|pending_approval|queued|running|verified|failed
    checks: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    blocked_reason: Mapped[str | None] = mapped_column(Text)
    approval_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
