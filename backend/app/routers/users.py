from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Entry, User
from ..schemas import UserProgress, UserPublic

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
def list_users(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Everyone in the workspace, so tasks can be assigned to any person."""
    return db.scalars(select(User).order_by(User.display_name, User.email)).all()


@router.get("/progress", response_model=list[UserProgress])
def users_progress(
    start: date | None = Query(default=None, description="Filter: date >= start"),
    end: date | None = Query(default=None, description="Filter: date <= end"),
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """How each person is progressing, based on tasks assigned to them.

    Optional date range narrows it to (for example) the current week or month.
    """
    users = db.scalars(select(User).order_by(User.display_name, User.email)).all()

    results: list[UserProgress] = []
    for user in users:
        stmt = select(Entry).where(Entry.assignee_id == user.id)
        if start is not None:
            stmt = stmt.where(Entry.entry_date >= start)
        if end is not None:
            stmt = stmt.where(Entry.entry_date <= end)
        entries = db.scalars(stmt).all()

        total = len(entries)
        completed = sum(1 for e in entries if e.completed)
        pending = total - completed
        percent = round((completed / total) * 100, 1) if total else 0.0

        results.append(
            UserProgress(
                user=UserPublic.model_validate(user),
                total=total,
                completed=completed,
                pending=pending,
                percent=percent,
            )
        )
    return results
