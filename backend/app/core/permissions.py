"""Role-based access control (least privilege).

Roles, from most to least powerful: owner > admin > operator > viewer.
`client` is reserved for the future client portal and sees nothing internal.
"""
from enum import StrEnum


class Role(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"
    CLIENT = "client"


class Perm(StrEnum):
    READ = "workspace:read"
    PROJECTS_WRITE = "projects:write"
    TASKS_WRITE = "tasks:write"
    CLIENTS_WRITE = "clients:write"
    AGENTS_DISPATCH = "agents:dispatch"
    AGENTS_MANAGE = "agents:manage"
    APPROVALS_DECIDE = "approvals:decide"
    AUDIT_READ = "audit:read"
    EVENTS_READ = "events:read"
    WEBSITES_CHECK = "websites:check"
    USERS_MANAGE = "users:manage"


ROLE_PERMISSIONS: dict[Role, frozenset[Perm]] = {
    Role.OWNER: frozenset(Perm),
    Role.ADMIN: frozenset(Perm) - {Perm.APPROVALS_DECIDE, Perm.AGENTS_MANAGE, Perm.USERS_MANAGE},
    Role.OPERATOR: frozenset(
        {Perm.READ, Perm.PROJECTS_WRITE, Perm.TASKS_WRITE, Perm.CLIENTS_WRITE, Perm.AGENTS_DISPATCH, Perm.WEBSITES_CHECK}
    ),
    Role.VIEWER: frozenset({Perm.READ}),
    Role.CLIENT: frozenset(),
}


def has_permission(role: str, perm: Perm) -> bool:
    try:
        return perm in ROLE_PERMISSIONS[Role(role)]
    except ValueError:
        return False
