from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TaskStatus = Literal["backlog", "todo", "in_progress", "review", "blocked", "done"]
Priority = Literal["low", "medium", "high", "critical"]
AssigneeKind = Literal["owner", "agent", "person"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=2, max_length=300)
    description: str | None = Field(default=None, max_length=8000)
    project_id: str | None = None
    status: TaskStatus = "todo"
    priority: Priority = "medium"
    assignee_kind: AssigneeKind = "owner"
    assignee_agent_id: str | None = None
    assignee_name: str | None = Field(default=None, max_length=200)
    due_date: date | None = None
    requires_approval: bool = False


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=300)
    description: str | None = None
    project_id: str | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None
    assignee_kind: AssigneeKind | None = None
    assignee_agent_id: str | None = None
    assignee_name: str | None = None
    due_date: date | None = None
    requires_approval: bool | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    description: str | None
    project_id: str | None
    project_name: str | None = None
    status: str
    priority: str
    assignee_kind: str
    assignee_agent_id: str | None
    assignee_agent_name: str | None = None
    assignee_name: str | None
    due_date: date | None
    requires_approval: bool
    completed_at: datetime | None
    is_demo: bool
    created_at: datetime
    updated_at: datetime


class TaskEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    kind: str
    from_status: str | None
    to_status: str | None
    actor_label: str
    created_at: datetime
