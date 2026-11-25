from fastapi import APIRouter

from app.events.router import router as events
from app.modules.agents.router import router as agents
from app.modules.approvals.router import router as approvals
from app.modules.billing.router import router as billing
from app.modules.leads.router import router as leads
from app.modules.portal.router import router as portal
from app.modules.retainers.router import router as retainers
from app.modules.time_tracking.router import router as time_entries
from app.modules.audit.router import router as audit
from app.modules.clients.router import router as clients
from app.modules.dashboard.router import router as dashboard
from app.modules.finance_bridge.router import router as finance
from app.modules.identity.router import router as auth
from app.modules.projects.router import router as projects
from app.modules.reports.router import router as reports
from app.modules.search.router import router as search
from app.modules.tasks.router import router as tasks
from app.modules.websites.router import router as websites
from app.modules.showcase.router import router as showcase
from app.modules.future_projects.router import router as future_projects

api_router = APIRouter(prefix="/api/v1")
for r in (auth, dashboard, projects, tasks, clients, leads, time_entries, retainers, billing, portal, agents, approvals, websites, showcase, future_projects, reports, search, finance, audit, events):
    api_router.include_router(r)
