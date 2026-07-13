from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import auth, entries, sprints, users
from .schemas import DayWindow, RulesOut
from .time_rules import WEEKDAY_WINDOW, WEEKEND_WINDOW

# Create tables on startup (simple approach; swap for Alembic if it grows).
Base.metadata.create_all(bind=engine)

app = FastAPI(title="edu-timetabelo API", version="1.0.0")

origins = (
    ["*"]
    if settings.cors_origins.strip() == "*"
    else [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
)

# We authenticate with Bearer tokens (Authorization header), not cookies, so we
# don't need credentialed CORS. That lets us safely use the "*" wildcard, which
# browsers forbid when allow_credentials is True.
allow_credentials = origins != ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(entries.router)
app.include_router(sprints.router)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}


@app.get("/api/rules", response_model=RulesOut, tags=["meta"])
def rules():
    """Expose the allowed scheduling windows so the frontend can enforce them too."""
    return RulesOut(
        weekday=DayWindow(
            is_weekend=False, start=WEEKDAY_WINDOW.start, end=WEEKDAY_WINDOW.end
        ),
        weekend=DayWindow(
            is_weekend=True, start=WEEKEND_WINDOW.start, end=WEEKEND_WINDOW.end
        ),
    )
