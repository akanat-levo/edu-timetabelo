from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, overridable via environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # SQLite file lives in a directory that can be backed by a k8s PersistentVolume.
    database_url: str = "sqlite:///./data/timetable.db"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # CORS: comma separated list of allowed origins, or "*" for all.
    cors_origins: str = "*"

    # If set, new users must supply this exact code to register.
    # Leave empty to allow open registration (fine for local dev).
    invite_code: str = ""

    # Email configuration for sending task reminders
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_enabled: bool = False


settings = Settings()
