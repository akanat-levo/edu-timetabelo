from datetime import date, datetime, time as datetime_time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Entry, Sprint, User
from ..schemas import CopyDayRequest, EntryCreate, EntryOut, EntryUpdate
from ..time_rules import ScheduleRuleError, validate_entry
from ..email_service import send_overdue_task_email

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
        assignee_id=entry.assignee_id,
        completed=entry.completed,
        status=entry.status,
        day_of_week=entry.entry_date.weekday(),
        created_at=entry.created_at,
        owner_id=entry.owner_id,
        creator_name=entry.creator.display_name or entry.creator.email,
        assignee_name=(
            (entry.assignee.display_name or entry.assignee.email)
            if entry.assignee
            else None
        ),
    )


def _get_entry(entry_id: int, db: Session) -> Entry:
    entry = db.get(Entry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found.")
    return entry


def _can_modify(entry: Entry, user: User) -> bool:
    # Creator or current assignee may change a task.
    return user.id in {entry.owner_id, entry.assignee_id}


def _validate_sprint(sprint_id: int | None, db: Session) -> None:
    if sprint_id is None:
        return
    if db.get(Sprint, sprint_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid sprint_id.")


def _validate_assignee(assignee_id: int | None, db: Session) -> None:
    if assignee_id is None:
        return
    if db.get(User, assignee_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid assignee_id.")


@router.get("", response_model=list[EntryOut])
def list_entries(
    start: date | None = Query(default=None, description="Filter: date >= start"),
    end: date | None = Query(default=None, description="Filter: date <= end"),
    sprint_id: int | None = Query(default=None),
    assignee_id: int | None = Query(default=None, description="Filter by assignee"),
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Shared workspace: everyone sees all tasks. Filters narrow the view.
    stmt = select(Entry)
    if start is not None:
        stmt = stmt.where(Entry.entry_date >= start)
    if end is not None:
        stmt = stmt.where(Entry.entry_date <= end)
    if sprint_id is not None:
        stmt = stmt.where(Entry.sprint_id == sprint_id)
    if assignee_id is not None:
        stmt = stmt.where(Entry.assignee_id == assignee_id)
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

    _validate_sprint(payload.sprint_id, db)
    _validate_assignee(payload.assignee_id, db)

    entry = Entry(
        owner_id=current_user.id,
        # Unassigned tasks default to the creator.
        assignee_id=payload.assignee_id or current_user.id,
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


@router.post("/copy", response_model=list[EntryOut], status_code=status.HTTP_201_CREATED)
def copy_day(
    payload: CopyDayRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Duplicate every task on source_date onto each target date.

    Copies keep their title, times, assignee and sprint, but are marked not
    completed and owned by whoever performs the copy.
    """
    sources = db.scalars(
        select(Entry).where(Entry.entry_date == payload.source_date)
    ).all()

    created: list[Entry] = []
    for target in payload.target_dates:
        if target == payload.source_date:
            continue  # skip copying a day onto itself
        for src in sources:
            copy = Entry(
                owner_id=current_user.id,
                assignee_id=src.assignee_id,
                title=src.title,
                description=src.description,
                entry_date=target,
                start_time=src.start_time,
                end_time=src.end_time,
                sprint_id=src.sprint_id,
                completed=False,
            )
            db.add(copy)
            created.append(copy)

    db.commit()
    for c in created:
        db.refresh(c)
    return [_to_out(c) for c in created]


@router.patch("/{entry_id}", response_model=EntryOut)
def update_entry(
    entry_id: int,
    payload: EntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = _get_entry(entry_id, db)
    if not _can_modify(entry, current_user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the creator or the assignee can change this task.",
        )

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
        _validate_sprint(payload.sprint_id, db)
    if payload.assignee_id is not None:
        _validate_assignee(payload.assignee_id, db)

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
    entry = _get_entry(entry_id, db)
    if not _can_modify(entry, current_user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the creator or the assignee can delete this task.",
        )
    entry.status = "cancelled"
    db.commit()


@router.post("/check-overdue", status_code=status.HTTP_200_OK)
def check_overdue_tasks(db: Session = Depends(get_db)):
    """Check for overdue incomplete tasks and send email notifications.

    This endpoint should be called periodically (e.g., via a cron job).
    """
    now = datetime.now()

    # Find all incomplete tasks where the end_time has passed today
    # and the notification hasn't been sent yet
    incomplete_entries = db.scalars(
        select(Entry).where(
            and_(
                Entry.entry_date == date.today(),
                Entry.completed == False,
                Entry.status == "pending",
                Entry.overdue_notified == False,
            )
        )
    ).all()

    sent_count = 0
    for entry in incomplete_entries:
        # Parse the end_time and check if it has passed
        end_hour, end_min = map(int, entry.end_time.split(":"))
        end_datetime = datetime.combine(
            entry.entry_date,
            datetime_time(end_hour, end_min)
        )

        if now >= end_datetime:
            # Send email to assignee
            if entry.assignee:
                if send_overdue_task_email(
                    entry.assignee.email,
                    entry.title,
                    entry.entry_date.isoformat(),
                    entry.end_time
                ):
                    entry.overdue_notified = True
                    sent_count += 1

    db.commit()
    return {
        "message": "Overdue check completed",
        "tasks_checked": len(incomplete_entries),
        "emails_sent": sent_count
    }
