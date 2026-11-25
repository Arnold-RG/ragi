# RAGI API — Created by Arnold Rurangwa / Arnova Group
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_CACHE_DIR=/tmp/uv-cache
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .
RUN useradd --system --uid 10001 ragi && chown -R ragi /app && mkdir -p /tmp/uv-cache && chown ragi /tmp/uv-cache
ENV PATH="/app/.venv/bin:$PATH"
USER ragi
EXPOSE 8410
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import os,urllib.request;p=os.environ.get('PORT','8410');urllib.request.urlopen(f'http://127.0.0.1:{p}/health')"
# Render sets PORT and terminates TLS. Trust the platform proxy hop only.
CMD ["sh", "-c", "DATABASE_URL=\"${MIGRATE_DATABASE_URL:-$DATABASE_URL}\" alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8410} --proxy-headers --forwarded-allow-ips='*'"]
