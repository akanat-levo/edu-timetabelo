from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Entry, Sprint, User
from ..schemas import EntryCreate, EntryOut, EntryUpdate
from ..time_rules import ScheduleRuleError, validate_entry

router = APIRouter(prefix="/api/entries", tags=["entries"])


def _to_out(entry: Entry) -> EntryOut:
    return EntryOut(
        id=entry.id,
        title=entry.title,
        description=entry.description,
        entry_date=entry.entry_date,
        start_time=entry.start_time,
        end_time=entry.end_time,
        sprint_id=entry.sprint_id,
        completed=entry.completed,
        day_of_week=entry.entry_date.weekday(),
        created_at=entry.created_at,
    )


def _get_owned_entry(entry_id: int, user: User, db: Session) -> Entry:
    entry = db.get(Entry, entry_id)
    if entry is None or entry.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found.")
    return entry


def _validate_sprint(sprint_id: int | None, user: User, db: Session) -> None:
    if sprint_id is None:
        return
    sprint = db.get(Sprint, sprint_id)
    if sprint is None or sprint.owner_id != user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid sprint_id.")


@router.get("", response_model=list[EntryOut])
def list_entries(
    start: date | None = Query(default=None, description="Filter: date >= start"),
    end: date | None = Query(default=None, description="Filter: date <= end"),
    sprint_id: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Entry).where(Entry.owner_id == current_user.id)
    if start is not None:
        stmt = stmt.where(Entry.entry_date >= start)
    if end is not None:
        stmt = stmt.where(Entry.entry_date <= end)
    if sprint_id is not None:
        stmt = stmt.where(Entry.sprint_id == sprint_id)
    stmt = stmt.order_by(Entry.entry_date, Entry.start_time)
    return [_to_out(e) for e in db.scalars(stmt).all()]


@router.post("", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: EntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        validate_entry(payload.entry_date, payload.start_time, payload.end_time)
    except ScheduleRuleError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    _validate_sprint(payload.sprint_id, current_user, db)

    entry = Entry(
        owner_id=current_user.id,
        title=payload.title,
        description=payload.description,
        entry_date=payload.entry_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        sprint_id=payload.sprint_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _to_out(entry)


@router.patch("/{entry_id}", response_model=EntryOut)
def update_entry(
    entry_id: int,
    payload: EntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = _get_owned_entry(entry_id, current_user, db)

    new_date = payload.entry_date if payload.entry_date is not None else entry.entry_date
    new_start = payload.start_time if payload.start_time is not None else entry.start_time
    new_end = payload.end_time if payload.end_time is not None else entry.end_time

    if (
        payload.entry_date is not None
        or payload.start_time is not None
        or payload.end_time is not None
    ):
        try:
            validate_entry(new_date, new_start, new_end)
        except ScheduleRuleError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))

    if payload.sprint_id is not None:
        _validate_sprint(payload.sprint_id, current_user, db)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return _to_out(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = _get_owned_entry(entry_id, current_user, db)
    db.delete(entry)
    db.commit()
