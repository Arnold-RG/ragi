"""Seed RAGI with the owner account, agent profiles, the ecosystem project
registry. Generic SAMPLE data only with --with-demo (off by default).

Usage:
  uv run python -m scripts.seed --owner-email you@example.com --password-file /secure/path/owner.txt
The owner password comes from RAGI_OWNER_PASSWORD, or is generated and written
to --password-file (chmod 600). It is never printed or committed.

Everything with is_demo=True is generic sample data and shows a SAMPLE badge.
"""
import argparse
import os
import secrets
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from app.core.crypto import encrypt
from app.core.security import hash_password, new_totp_secret, totp_uri
from app.database import models  # noqa: F401
from app.database.session import SessionLocal
from app.events.outbox import publish
from app.modules.agents import service as agents
from app.modules.agents.models import Agent
from app.modules.approvals.models import Approval
from app.modules.audit.service import record
from app.modules.clients.models import Client
from app.modules.identity.models import Organization, User
from app.modules.projects.models import Project, ProjectMilestone
from app.modules.projects.service import DEFAULT_INTEGRATIONS
from app.modules.tasks.models import Task, TaskEvent
from app.modules.websites.models import Website
from app.modules.leads.models import Lead
from app.modules.retainers.models import Retainer
from app.modules.time_tracking.models import TimeEntry

SEED = "Seed script"


def now() -> datetime:
    return datetime.now(UTC)


def _append_secret(password_file: Path, line: str) -> None:
    """Append to a credentials file that is created 0600 from the start (never world-readable)."""
    password_file.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(password_file, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(fd, "a") as fh:
        fh.write(line + "\n")


def ensure_user(db, org, email: str, password_file: Path | None, *, full_name: str, role: str,
                env_var: str | None = None, client_id: str | None = None, with_mfa: bool = False) -> None:
    email = email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        return
    pw = os.environ.get(env_var) if env_var else None
    if not pw and not password_file:
        raise SystemExit(f"Set {env_var} or pass --password-file")
    user = User(organization_id=org.id, email=email, full_name=full_name, role=role, client_id=client_id, password_hash="")
    if not pw:
        pw = secrets.token_urlsafe(18)
        _append_secret(password_file, f"[{role}] email={email} password={pw}")
    user.password_hash = hash_password(pw)
    if with_mfa:
        # Owner/admin must use MFA (spec §15). The secret is stored encrypted; the
        # enrolment URI goes only to the 0600 file so the owner can add it to an authenticator.
        totp_secret = new_totp_secret()
        user.mfa_secret_enc, user.mfa_enabled = encrypt(totp_secret), True
        if password_file:
            _append_secret(password_file, f"[{role}] totp_secret={totp_secret} otpauth={totp_uri(totp_secret, email)}")
    db.add(user)


# Ecosystem registry (spec §13). Real names, unverified until the owner confirms
# repository names and URLs. Tasks below are genuine open items, not demo.
ECOSYSTEM = [
    dict(slug="ragi", name="RAGI v2", category="operations", status="active", priority="critical",
         summary="Operations engine: projects, tasks, clients, agents, approvals and monitoring.",
         tasks=[("Owner review of the local RAGI v2 build", "review", "high"),
                ("Decide repository visibility and licence", "todo", "high"),
                ("Connect OMH budget reservations", "backlog", "medium")]),
    dict(slug="our-money-hub", name="Our Money Hub v2", category="finance", status="active", priority="critical",
         summary="Financial engine: ledger, budgets, subscriptions and AI spend.",
         tasks=[("Owner review of the local OMH v2 build", "review", "high")]),
    dict(slug="2day-movies", name="2Day Movies", category="entertainment", status="unverified", priority="high",
         summary="Discovery site for free, official YouTube film uploads.",
         url="https://twodaymovie-site.onrender.com",
         tasks=[("Add consent banner before YouTube embeds load (GDPR)", "todo", "critical"),
                ("Restrict catalogue to official / rights-holder channels", "todo", "critical"),
                ("Publish only the site files, not the repo root", "todo", "high"),
                ("Add 'Created by Arnold Rurangwa / Arnova Group' footer credit", "todo", "medium")]),
    dict(slug="arnovagroup-agency", name="ArnovaGroup Agency website", category="agency-website", status="unverified",
         priority="high", summary="Official company website.", tasks=[]),
    dict(slug="portfolio", name="Professional portfolio", category="portfolio", status="unverified", priority="medium",
         summary="Professional project portfolio.", tasks=[]),
]

# OPT-IN sample data (--with-demo) for tests and UI previews only. Deliberately generic:
# no real-sounding businesses, no prices, no rates, no "completed" client work (Forge B1).
DEMO_CLIENTS = [
    dict(name="Sample client A", contact_name="Sample contact", city=None, sector=None, status="active"),
    dict(name="Sample client B", contact_name="Sample contact", city=None, sector=None, status="prospect"),
]

DEMO_PROJECTS = [
    dict(client=0, name="Sample project A", category="client-website", status="active", priority="high",
         start=-14, due=21, summary="SAMPLE DATA — shows how a client project looks in RAGI.",
         milestones=[("Sample milestone 1", -5, True), ("Sample milestone 2", 10, False)],
         tasks=[("Sample task 1", "done", "medium", -6), ("Sample task 2", "done", "high", -3),
                ("Sample task 3", "in_progress", "high", 3), ("Sample task 4", "review", "medium", 2),
                ("Sample task 5", "todo", "medium", 9), ("Sample task 6", "blocked", "low", 4)]),
    dict(client=1, name="Sample project B", category="client-website", status="upcoming", priority="medium",
         start=10, due=60, summary="SAMPLE DATA — an upcoming project created from a won lead.",
         milestones=[("Sample kick-off", 10, False)],
         tasks=[("Sample scoping task", "todo", "medium", 7)]),
]


def seed(owner_email: str, password_file: Path | None, with_demo: bool) -> None:
    db = SessionLocal()
    try:
        org = db.scalar(select(Organization).where(Organization.slug == "arnovagroup"))
        if not org:
            org = Organization(slug="arnovagroup", name="Arnova Group", country="RW")
            db.add(org)
            db.flush()
        owner_email = owner_email.strip().lower()
        ensure_user(db, org, owner_email, password_file, full_name="Arnold Rurangwa", role="owner",
                    env_var="RAGI_OWNER_PASSWORD", with_mfa=True)
        new_agents = agents.sync_profiles(db, org.id)
        db.flush()
        if db.scalar(select(Project).where(Project.organization_id == org.id).limit(1)):
            db.commit()
            print(f"Already seeded (agents added: {new_agents}).")
            return

        today = date.today()
        for e in ECOSYSTEM:
            p = Project(organization_id=org.id, slug=e["slug"], name=e["name"], category=e["category"], status=e["status"],
                        priority=e["priority"], summary=e["summary"], repo_provider="github", repo_owner="Arnold-RG",
                        production_url=e.get("url"), integrations=DEFAULT_INTEGRATIONS, verified=False, is_demo=False)
            db.add(p)
            db.flush()
            publish(db, "project.created", {"project_id": p.slug, "name": p.name, "category": p.category, "status": p.status}, project_id=p.slug)
            for i, (title, status, prio) in enumerate(e["tasks"]):
                t = Task(organization_id=org.id, project_id=p.id, title=title, status=status, priority=prio, position=i)
                db.add(t)
                db.flush()
                db.add(TaskEvent(task_id=t.id, kind="created", to_status=status, actor_label=SEED))
            if e.get("url"):
                db.add(Website(organization_id=org.id, project_id=p.id, label=e["name"], url=e["url"]))

        if with_demo:
            clients = []
            for c in DEMO_CLIENTS:
                cl = Client(organization_id=org.id, country="RW", is_demo=True,
                            notes="SAMPLE DATA — not a real client.", **c)
                db.add(cl)
                clients.append(cl)
            db.flush()
            agent_ids = {a.slug: a.id for a in db.scalars(select(Agent).where(Agent.organization_id == org.id))}
            for dp in DEMO_PROJECTS:
                p = Project(organization_id=org.id, slug=dp["name"].lower().split(" —")[0].replace(" ", "-") + "-demo",
                            name=dp["name"], category=dp["category"], status=dp["status"], priority=dp["priority"],
                            summary=dp["summary"], client_id=clients[dp["client"]].id, is_demo=True,
                            start_date=today + timedelta(days=dp["start"]), due_date=today + timedelta(days=dp["due"]),
                            integrations=DEFAULT_INTEGRATIONS)
                if dp["status"] == "completed":
                    p.completed_at = now() + timedelta(days=dp["due"])
                db.add(p)
                db.flush()
                for title, off, done in dp["milestones"]:
                    db.add(ProjectMilestone(project_id=p.id, title=title, due_date=today + timedelta(days=off), done=done))
                for i, (title, status, prio, due) in enumerate(dp["tasks"]):
                    created = now() - timedelta(days=13 - (i * 2) % 12, hours=i)
                    t = Task(organization_id=org.id, project_id=p.id, title=title, status=status, priority=prio, position=i,
                             is_demo=True, due_date=today + timedelta(days=due) if due is not None else None,
                             assignee_kind="agent" if i % 3 == 0 else "owner",
                             assignee_agent_id=agent_ids[["forge", "sentinel", "nova"][i % 3]] if i % 3 == 0 else None)
                    db.add(t)
                    db.flush()
                    db.add(TaskEvent(task_id=t.id, kind="created", to_status="todo", actor_label=SEED, created_at=created))
                    if status == "done":
                        t.completed_at = created + timedelta(days=1 + i % 3)
                        if t.completed_at > now():
                            t.completed_at = now() - timedelta(hours=1)
                        db.add(TaskEvent(task_id=t.id, kind="status", from_status="todo", to_status="done",
                                         actor_label=SEED, created_at=t.completed_at))
            demo_projects = {p.name: p for p in db.scalars(select(Project).where(Project.is_demo))}
            pa = demo_projects["Sample project A"]
            ret = Retainer(organization_id=org.id, client_id=pa.client_id, name="Sample retainer", hours_per_month=10,
                           monthly_fee=None, currency="PLN", starts_on=today.replace(day=1), is_demo=True)
            db.add(ret)
            db.flush()
            pa.retainer_id = ret.id
            owner = db.scalar(select(User).where(User.email == owner_email))
            month_start = now().replace(day=1, hour=8, minute=0, second=0, microsecond=0)
            span = max(1, (now() - month_start).days)
            for i, (mins, bill) in enumerate([(90, True), (120, True), (45, False), (60, True)]):
                st = month_start + timedelta(days=(i * 3) % span, hours=i % 5)
                db.add(TimeEntry(organization_id=org.id, user_id=owner.id, project_id=pa.id, note=f"Sample session {i + 1}",
                                 billable=bill, started_at=st, ended_at=st + timedelta(minutes=mins), minutes=mins, is_demo=True))
            for i, stage in enumerate(["new", "contacted", "qualified", "proposal"]):
                db.add(Lead(organization_id=org.id, name=f"Sample lead {chr(65 + i)}", company=None, stage=stage,
                            currency="PLN", estimated_amount=None, service="Website", source="Sample", is_demo=True,
                            notes="SAMPLE DATA — not a real enquiry."))
            ensure_user(db, org, "portal-demo@ragi.local", password_file, full_name="Sample client A (portal)",
                        role="client", env_var="RAGI_PORTAL_DEMO_PASSWORD", client_id=pa.client_id)
            db.add(Approval(organization_id=org.id, kind="publish", title="Sample approval request",
                            detail="SAMPLE DATA — shows how an approval looks.", requested_by="Seed script (sample)", is_demo=True))
            db.flush()
            # Show the safety guard working: a real dispatch through the guard (it will be blocked).
            forge = db.scalar(select(Agent).where(Agent.organization_id == org.id, Agent.slug == "forge"))
            task = db.scalar(select(Task).where(Task.title == "Sample task 3"))
            db.flush()
            run = agents.dispatch(db, forge, task, "frontend_engineering", SEED)
            record(db, SEED, "agent.dispatch", "agent_run", run.id, summary=f"Dispatch to FORGE: {run.status}",
                   organization_id=org.id)
        record(db, SEED, "system.seeded", "organization", org.id, summary="Registry loaded" + (" with sample data" if with_demo else ""), organization_id=org.id)
        db.commit()
        print("Seed complete." + (" Demo data included." if with_demo else ""))
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--owner-email", default=os.environ.get("RAGI_OWNER_EMAIL", "owner@ragi.local"))
    ap.add_argument("--password-file", type=Path)
    ap.add_argument("--with-demo", action="store_true",
                    help="Add clearly-labelled generic SAMPLE data (off by default: real data only)")
    a = ap.parse_args()
    seed(a.owner_email, a.password_file, a.with_demo)
