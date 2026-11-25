from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, IdMixin, TimestampMixin


class BillingHandoff(IdMixin, TimestampMixin, Base):
    """A quote or invoice REQUEST prepared in RAGI and handed to OMH.

    OMH is the book of record: it numbers, issues, sends and collects. RAGI keeps
    only the request, the owner's approval and the status OMH reports back.
    """

    __tablename__ = "billing_handoffs"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # quote | invoice
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    lines: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # draft → pending_approval → handed_to_omh → (issued | paid, reported by OMH) ; or rejected
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False, index=True)
    approval_id: Mapped[str | None] = mapped_column(String(36))
    outbox_event_id: Mapped[str | None] = mapped_column(String(64))
    omh_reference: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    handed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
