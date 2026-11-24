from datetime import date, datetime
from typing import Literal

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_serializer

ProjectStatus = Literal["upcoming", "active", "paused", "completed", "unverified"]
Priority = Literal["low", "medium", "high", "critical"]
Category = Literal[
    "operations", "finance", "entertainment", "agency-website", "client-website",
    "portfolio", "cybersecurity", "mobile-app", "product",
]


class ProjectBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9][a-z0-9-]{1,79}$")
    category: Category = "client-website"
    status: ProjectStatus = "upcoming"
    priority: Priority = "medium"
    summary: str | None = Field(default=None, max_length=4000)
    client_id: str | None = None
    repo_owner: str | None = Field(default=None, max_length=100)
    repo_name: str | None = Field(default=None, max_length=100)
    production_url: HttpUrl | None = None
    start_date: date | None = None
    due_date: date | None = None
    retainer_id: str | None = None
    hourly_rate: str | None = Field(default=None, pattern=r"^\d{1,15}(\.\d{1,2})?$")
    currency: Literal["PLN", "RWF", "EUR", "USD"] = "RWF"


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    category: Category | None = None
    status: ProjectStatus | None = None
    priority: Priority | None = None
    summary: str | None = None
    client_id: str | None = None
    repo_owner: str | None = None
    repo_name: str | None = None
    production_url: HttpUrl | None = None
    start_date: date | None = None
    due_date: date | None = None
    retainer_id: str | None = None
    hourly_rate: str | None = Field(default=None, pattern=r"^\d{1,15}(\.\d{1,2})?$")
    currency: Literal["PLN", "RWF", "EUR", "USD"] | None = None


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    due_date: date | None
    done: bool


class MilestoneCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    due_date: date | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    slug: str
    name: str
    category: str
    status: str
    priority: str
    summary: str | None
    client_id: str | None
    client_name: str | None = None
    repo_provider: str | None
    repo_owner: str | None
    repo_name: str | None
    production_url: str | None
    start_date: date | None
    due_date: date | None
    completed_at: datetime | None
    retainer_id: str | None = None
    hourly_rate: Decimal | None = None
    currency: str = "RWF"
    verified: bool
    is_demo: bool
    owner_approval_required: bool
    task_total: int = 0
    task_done: int = 0
    progress: int = 0
    created_at: datetime
    updated_at: datetime


    @field_serializer("hourly_rate")
    def _rate(self, v: Decimal | None):
        return None if v is None else str(v)


class ProjectDetail(ProjectOut):
    milestones: list[MilestoneOut] = []
    integrations: dict = {}
