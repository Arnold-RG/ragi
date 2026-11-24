from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.audit.service import record
from app.modules.clients.models import Client
from app.modules.clients.schemas import ClientCreate, ClientOut, ClientUpdate
from app.modules.identity.deps import require
from app.modules.projects.models import Project

router = APIRouter(prefix="/clients", tags=["clients"])


def _out(db: Session, c: Client) -> ClientOut:
    n = db.scalar(select(func.count()).select_from(Project).where(Project.client_id == c.id)) or 0
    return ClientOut.model_validate(c).model_copy(update={"project_count": n})


@router.get("", response_model=list[ClientOut])
def list_clients(status: str | None = None, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    q = select(Client).where(Client.organization_id == user.organization_id)
    if status:
        q = q.where(Client.status == status)
    return [_out(db, c) for c in db.scalars(q.order_by(Client.name)).all()]


@router.post("", response_model=ClientOut, status_code=201)
def create_client(body: ClientCreate, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.CLIENTS_WRITE))):
    c = Client(organization_id=user.organization_id, **body.model_dump())
    db.add(c)
    db.flush()
    record(db, user, "client.created", "client", c.id, summary=f"Added client {c.name}", request=request)
    db.commit()
    return _out(db, c)


def _get(db: Session, user, client_id: str) -> Client:
    c = db.get(Client, client_id)
    if not c or c.organization_id != user.organization_id:
        raise not_found("Client")
    return c


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: str, db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    return _out(db, _get(db, user, client_id))


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(client_id: str, body: ClientUpdate, request: Request, db: Session = Depends(get_db), user=Depends(require(Perm.CLIENTS_WRITE))):
    c = _get(db, user, client_id)
    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(c, k, v)
    record(db, user, "client.updated", "client", c.id, summary=f"Updated client {c.name}", detail={"fields": sorted(changes)}, request=request)
    db.commit()
    return _out(db, c)
