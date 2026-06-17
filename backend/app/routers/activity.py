"""Read-only activity log of order events (placed / cancelled)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=list[schemas.OrderEventOut])
def list_activity(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Most recent order activity first. Read-only — there is no write endpoint."""
    return db.scalars(
        select(models.OrderEvent).order_by(models.OrderEvent.id.desc()).limit(limit)
    ).all()
