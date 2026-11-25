from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, IdMixin, TimestampMixin


class Retainer(IdMixin, TimestampMixin, Base):
    """Recurring work agreement. RAGI tracks hours; OMH owns the money and invoices."""

    __tablename__ = "retainers"
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    hours_per_month: Mapped[int] = mapped_column(Integer, nullable=False)
    monthly_fee: Mapped[object | None] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3), default="PLN", nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="active", nullable=False)  # active|paused|ended
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
