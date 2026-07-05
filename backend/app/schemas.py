from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- Auth ----
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---- Entries (tasks on a real calendar date) ----
class EntryBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    entry_date: date
    start_time: str = Field(description="24h time, 'HH:MM'")
    end_time: str = Field(description="24h time, 'HH:MM'")
    sprint_id: int | None = None


class EntryCreate(EntryBase):
    pass


class EntryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    entry_date: date | None = None
    start_time: str | None = None
    end_time: str | None = None
    completed: bool | None = None
    sprint_id: int | None = None


class EntryOut(EntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    completed: bool
    day_of_week: int
    created_at: datetime


# ---- Sprints (weekly / monthly planning periods) ----
class SprintBase(BaseModel):
    kind: str = Field(pattern="^(weekly|monthly)$")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    start_date: date
    end_date: date


class SprintCreate(SprintBase):
    pass


class SprintAuto(BaseModel):
    """Create a sprint by picking a kind + any date inside the desired period.

    The server computes the correct start/end range automatically.
    """

    kind: str = Field(pattern="^(weekly|monthly)$")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    anchor_date: date


class SprintUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    start_date: date | None = None
    end_date: date | None = None


class SprintOut(SprintBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class SprintProgress(BaseModel):
    sprint: SprintOut
    total: int
    completed: int
    percent: float


# ---- Rules (exposed so the frontend can render allowed windows) ----
class DayWindow(BaseModel):
    is_weekend: bool
    start: str
    end: str


class RulesOut(BaseModel):
    weekday: DayWindow
    weekend: DayWindow
