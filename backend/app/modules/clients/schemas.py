from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.emails import EmailAddress

ClientStatus = Literal["prospect", "active", "paused", "archived"]


class ClientBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    contact_name: str | None = Field(default=None, max_length=200)
    email: EmailAddress | None = None
    phone: str | None = Field(default=None, max_length=40)
    city: str | None = Field(default=None, max_length=100)
    country: str = Field(default="RW", min_length=2, max_length=2)
    sector: str | None = Field(default=None, max_length=100)
    status: ClientStatus = "active"
    notes: str | None = Field(default=None, max_length=4000)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    contact_name: str | None = None
    email: EmailAddress | None = None
    phone: str | None = None
    city: str | None = None
    sector: str | None = None
    status: ClientStatus | None = None
    notes: str | None = None


class ClientOut(ClientBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    is_demo: bool
    project_count: int = 0
    created_at: datetime
