from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Entry, Sprint, User
from ..schemas import (
    SprintAuto,
    SprintCreate,
    SprintOut,
    SprintProgress,
    SprintUpdate,
)
from ..time_rules import ScheduleRuleError, sprint_range

router = APIRouter(prefix="/api/sprints", tags=["sprints"])


def _get_owned_sprint(sprint_id: int, user: User, db: Session) -> Sprint:
    sprint = db.get(Sprint, sprint_id)
    if sprint is None or sprint.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found.")
    return sprint


@router.get("", response_model=list[SprintOut])
def list_sprints(
    kind: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Sprint).where(Sprint.owner_id == current_user.id)
    if kind is not None:
        stmt = stmt.where(Sprint.kind == kind)
    stmt = stmt.order_by(Sprint.start_date.desc())
    return db.scalars(stmt).all()


@router.post("", response_model=SprintOut, status_code=status.HTTP_201_CREATED)
def create_sprint(
    payload: SprintCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.start_date > payload.end_date:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "start_date must be on or before end_date.",
        )
    sprint = Sprint(owner_id=current_user.id, **payload.model_dump())
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return sprint


@router.post("/auto", response_model=SprintOut, status_code=status.HTTP_201_CREATED)
def create_sprint_auto(
    payload: SprintAuto,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a weekly/monthly sprint from an anchor date; server computes the range."""
    try:
        start, end = sprint_range(payload.kind, payload.anchor_date)
    except ScheduleRuleError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    sprint = Sprint(
        owner_id=current_user.id,
        kind=payload.kind,
        title=payload.title,
        description=payload.description,
        start_date=start,
        end_date=end,
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return sprint


@router.get("/{sprint_id}/progress", response_model=SprintProgress)
def sprint_progress(
    sprint_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sprint = _get_owned_sprint(sprint_id, current_user, db)
    entries = db.scalars(
        select(Entry).where(
            Entry.owner_id == current_user.id,
            Entry.entry_date >= sprint.start_date,
            Entry.entry_date <= sprint.end_date,
        )
    ).all()
    total = len(entries)
    completed = sum(1 for e in entries if e.completed)
    percent = round((completed / total) * 100, 1) if total else 0.0
    return SprintProgress(
        sprint=sprint, total=total, completed=completed, percent=percent
    )


@router.patch("/{sprint_id}", response_model=SprintOut)
def update_sprint(
    sprint_id: int,
    payload: SprintUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sprint = _get_owned_sprint(sprint_id, current_user, db)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(sprint, field, value)
    if sprint.start_date > sprint.end_date:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "start_date must be on or before end_date.",
        )
    db.commit()
    db.refresh(sprint)
    return sprint


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sprint(
    sprint_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sprint = _get_owned_sprint(sprint_id, current_user, db)
    db.delete(sprint)
    db.commit()
