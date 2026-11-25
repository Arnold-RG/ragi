"""Import every module's models so Alembic and metadata see them."""
from app.modules.identity.models import (  # noqa: F401
    AuthIdentity, AuthToken, InstanceSetting, MfaRecoveryCode, Organization, TrustedDevice, User, UserSession,
)
from app.core.ratelimit import AuthBackoff, RateLimitEvent  # noqa: F401
from app.modules.clients.models import Client  # noqa: F401
from app.modules.projects.models import Project, ProjectMilestone  # noqa: F401
from app.modules.tasks.models import Task, TaskEvent  # noqa: F401
from app.modules.agents.models import Agent, AgentRun  # noqa: F401
from app.modules.approvals.models import Approval  # noqa: F401
from app.modules.websites.models import Website, WebsiteHealthCheck  # noqa: F401
from app.modules.audit.models import AuditLog  # noqa: F401
from app.events.models import EventInbox, EventOutbox  # noqa: F401
from app.modules.leads.models import Lead  # noqa: F401
from app.modules.time_tracking.models import TimeEntry  # noqa: F401
from app.modules.retainers.models import Retainer  # noqa: F401
from app.modules.billing.models import BillingHandoff  # noqa: F401
from app.modules.future_projects.models import FutureProject  # noqa: F401
