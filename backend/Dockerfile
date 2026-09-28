# Multi-stage / Production Dockerfile for AQ COMPANIES Backend
FROM python:3.12-slim-bookworm AS base

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

WORKDIR /app

# Install minimal OS dependencies for compilation and PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create application non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser

# Copy application code
COPY . .

# Ensure upload and backup directories exist and have proper ownership
RUN mkdir -p /app/uploads /app/backups && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Docker Healthcheck targeting the observability probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production Entrypoint: Run migrations and launch Gunicorn with Uvicorn workers
CMD ["python", "scripts/start_production.py"]
