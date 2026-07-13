from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Entry, Sprint, User
from datetime import timedelta

from ..schemas import (
    DayProgress,
    SprintAuto,
    SprintCreate,
    SprintDetail,
    SprintOut,
    SprintProgress,
    SprintUpdate,
)
from ..time_rules import ScheduleRuleError, is_weekend, sprint_range

router = APIRouter(prefix="/api/sprints", tags=["sprints"])


def _get_sprint(sprint_id: int, db: Session) -> Sprint:
    sprint = db.get(Sprint, sprint_id)
    if sprint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found.")
    return sprint


def _require_owner(sprint: Sprint, user: User) -> None:
    if sprint.owner_id != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the sprint's creator can change it."
        )


@router.get("", response_model=list[SprintOut])
def list_sprints(
    kind: str | None = None,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Shared workspace: everyone sees all sprints.
    stmt = select(Sprint)
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
    sprint = _get_sprint(sprint_id, db)
    # Workspace-wide: count every task within the sprint's date range.
    entries = db.scalars(
        select(Entry).where(
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


@router.get("/{sprint_id}/breakdown", response_model=SprintDetail)
def sprint_breakdown(
    sprint_id: int,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Per-day progress across the sprint's date range (workspace-wide)."""
    sprint = _get_sprint(sprint_id, db)
    entries = db.scalars(
        select(Entry).where(
            Entry.entry_date >= sprint.start_date,
            Entry.entry_date <= sprint.end_date,
        )
    ).all()

    # Seed every day in the range so days with no tasks still appear.
    buckets: dict = {}
    cursor = sprint.start_date
    while cursor <= sprint.end_date:
        buckets[cursor] = {"total": 0, "completed": 0}
        cursor += timedelta(days=1)

    for e in entries:
        if e.entry_date in buckets:
            buckets[e.entry_date]["total"] += 1
            if e.completed:
                buckets[e.entry_date]["completed"] += 1

    days: list[DayProgress] = []
    for day, counts in sorted(buckets.items()):
        d_total = counts["total"]
        d_done = counts["completed"]
        days.append(
            DayProgress(
                date=day,
                day_of_week=day.weekday(),
                is_weekend=is_weekend(day.weekday()),
                total=d_total,
                completed=d_done,
                percent=round((d_done / d_total) * 100, 1) if d_total else 0.0,
            )
        )

    total = len(entries)
    completed = sum(1 for e in entries if e.completed)
    percent = round((completed / total) * 100, 1) if total else 0.0
    return SprintDetail(
        sprint=sprint, total=total, completed=completed, percent=percent, days=days
    )


@router.patch("/{sprint_id}", response_model=SprintOut)
def update_sprint(
    sprint_id: int,
    payload: SprintUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sprint = _get_sprint(sprint_id, db)
    _require_owner(sprint, current_user)
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
    sprint = _get_sprint(sprint_id, db)
    _require_owner(sprint, current_user)
    db.delete(sprint)
    db.commit()
