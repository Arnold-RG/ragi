import csv
import io
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import Perm
from app.database.session import get_db
from app.modules.audit.service import record
from app.modules.identity.deps import require
from app.modules.projects import service as project_service
from app.modules.projects.models import Project

router = APIRouter(prefix="/reports", tags=["reports"])

_FORMULA_START = ("=", "+", "-", "@", "\t", "\r", "\uff1d", "\uff0b", "\uff0d", "\uff20")


def csv_safe(value):
    """Neutralise spreadsheet formulas (CSV injection): prefix risky text with an apostrophe."""
    if isinstance(value, str) and value.startswith(_FORMULA_START):
        return "'" + value
    return value


@router.get("/operations")
def operations_report(format: Literal["json", "csv"] = "json", db: Session = Depends(get_db), user=Depends(require(Perm.READ))):
    """Project-by-project operational report. Every number comes from recorded tasks."""
    projects = db.scalars(select(Project).where(Project.organization_id == user.organization_id).order_by(Project.name)).all()
    counts = project_service.task_counts(db, [p.id for p in projects])
    rows = []
    for p in projects:
        o = project_service.to_out(db, p, counts)
        rows.append({"project": o.name, "status": o.status, "category": o.category, "client": o.client_name or "",
                     "tasks_done": o.task_done, "tasks_total": o.task_total, "progress_pct": o.progress,
                     "due_date": o.due_date.isoformat() if o.due_date else "", "demo": o.is_demo})
    record(db, user, "report.exported", "report", "operations", summary=f"Operations report ({format})")
    db.commit()
    generated = datetime.now(UTC).isoformat()
    if format == "csv":
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()) if rows else ["project"])
        w.writeheader()
        w.writerows({k: csv_safe(v) for k, v in r.items()} for r in rows)
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="ragi-operations-{generated[:10]}.csv"'})
    return {"report": "operations", "generated_at": generated, "created_by": "RAGI · Arnold Rurangwa / Arnova Group", "rows": rows}
