FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# The SQLite file lives here; mount a volume at /app/data in production.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 8000

# Shell form so ${PORT} expands. Render injects PORT; locally it defaults to 8000.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
