import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


def _ensure_sqlite_dir(url: str) -> None:
    """Make sure the directory for a SQLite file exists before connecting."""
    prefix = "sqlite:///"
    if url.startswith(prefix):
        path = url[len(prefix):]
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)


_ensure_sqlite_dir(settings.database_url)

connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
