from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, IdMixin, TimestampMixin


class Lead(IdMixin, TimestampMixin, Base):
    """Client pipeline: enquiry → qualified → proposal → won/lost."""

    __tablename__ = "leads"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    company: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(320))
    source: Mapped[str | None] = mapped_column(String(60))
    service: Mapped[str | None] = mapped_column(String(80))
    stage: Mapped[str] = mapped_column(String(20), default="new", nullable=False, index=True)
    estimated_amount: Mapped[object | None] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3), default="RWF", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    lost_reason: Mapped[str | None] = mapped_column(String(300))
    client_id: Mapped[str | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"))
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
