from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    entries: Mapped[list["Entry"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    sprints: Mapped[list["Sprint"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Sprint(Base):
    """A planning period grouping tasks over a date range.

    kind is "weekly" or "monthly". The date range is inclusive.
    """

    __tablename__ = "sprints"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    kind: Mapped[str] = mapped_column(String, nullable=False)  # "weekly" | "monthly"
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, default="")

    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    owner: Mapped["User"] = relationship(back_populates="sprints")
    entries: Mapped[list["Entry"]] = relationship(back_populates="sprint")


class Entry(Base):
    """A scheduled task on a specific calendar date."""

    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    sprint_id: Mapped[int | None] = mapped_column(
        ForeignKey("sprints.id", ondelete="SET NULL"), index=True, nullable=True
    )

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, default="")

    # The actual calendar date. day_of_week is derived from this.
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Stored as "HH:MM" 24-hour strings.
    start_time: Mapped[str] = mapped_column(String, nullable=False)
    end_time: Mapped[str] = mapped_column(String, nullable=False)

    completed: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    owner: Mapped["User"] = relationship(back_populates="entries")
    sprint: Mapped["Sprint | None"] = relationship(back_populates="entries")
