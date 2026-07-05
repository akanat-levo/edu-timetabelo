"""Core scheduling rules.

The timetable only allows entries inside specific windows depending on the
type of day the entry's calendar date falls on:

- Weekdays (Mon-Fri): 19:00 - 23:00
- Weekends (Sat-Sun): 10:00 - 17:00

It also provides helpers to compute weekly and monthly sprint ranges from a
given calendar date.
"""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class TimeWindow:
    start: str  # "HH:MM"
    end: str    # "HH:MM"


WEEKDAY_WINDOW = TimeWindow(start="19:00", end="23:00")
WEEKEND_WINDOW = TimeWindow(start="10:00", end="17:00")

WEEKEND_DAYS = {5, 6}  # Saturday, Sunday (Python weekday convention)


def is_weekend(day_of_week: int) -> bool:
    return day_of_week in WEEKEND_DAYS


def window_for_day(day_of_week: int) -> TimeWindow:
    return WEEKEND_WINDOW if is_weekend(day_of_week) else WEEKDAY_WINDOW


def _to_minutes(value: str) -> int:
    """Parse a 'HH:MM' string into minutes since midnight."""
    parts = value.split(":")
    if len(parts) != 2:
        raise ValueError(f"Invalid time format: {value!r}. Expected 'HH:MM'.")
    hours, minutes = int(parts[0]), int(parts[1])
    if not (0 <= hours <= 23 and 0 <= minutes <= 59):
        raise ValueError(f"Time out of range: {value!r}.")
    return hours * 60 + minutes


class ScheduleRuleError(ValueError):
    """Raised when an entry violates the timetable scheduling rules."""


def validate_entry(entry_date: date, start_time: str, end_time: str) -> None:
    """Validate a proposed entry against the allowed window for its date.

    Raises ScheduleRuleError with a human-readable message on any violation.
    """
    try:
        start = _to_minutes(start_time)
        end = _to_minutes(end_time)
    except ValueError as exc:
        raise ScheduleRuleError(str(exc)) from exc

    if start >= end:
        raise ScheduleRuleError("start_time must be earlier than end_time.")

    day_of_week = entry_date.weekday()
    window = window_for_day(day_of_week)
    win_start = _to_minutes(window.start)
    win_end = _to_minutes(window.end)

    day_kind = "weekend" if is_weekend(day_of_week) else "weekday"
    if start < win_start or end > win_end:
        raise ScheduleRuleError(
            f"{entry_date.isoformat()} is a {day_kind}; entries must fall within "
            f"{window.start}-{window.end}. Got {start_time}-{end_time}."
        )


# ---- Sprint range helpers ----

def weekly_sprint_range(anchor: date) -> tuple[date, date]:
    """Return (Monday, Sunday) of the week containing `anchor`."""
    start = anchor - timedelta(days=anchor.weekday())
    end = start + timedelta(days=6)
    return start, end


def monthly_sprint_range(anchor: date) -> tuple[date, date]:
    """Return (first day, last day) of the month containing `anchor`."""
    start = anchor.replace(day=1)
    last_day = monthrange(anchor.year, anchor.month)[1]
    end = anchor.replace(day=last_day)
    return start, end


def sprint_range(kind: str, anchor: date) -> tuple[date, date]:
    if kind == "weekly":
        return weekly_sprint_range(anchor)
    if kind == "monthly":
        return monthly_sprint_range(anchor)
    raise ScheduleRuleError(f"Unknown sprint kind: {kind!r}. Use 'weekly' or 'monthly'.")
