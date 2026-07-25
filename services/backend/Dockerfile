# -----------------------------------------------------------------------------
# Backend — FastAPI (multi-stage, production)
# Chainguard bases: 0 critical / 0 high OS CVEs (vs python:3.12-slim 1C/2H).
# -----------------------------------------------------------------------------
FROM cgr.dev/chainguard/python:latest-dev AS builder

WORKDIR /app

COPY requirements.txt .
RUN python -m venv /app/venv \
    && /app/venv/bin/pip install --upgrade pip \
    && /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------
FROM cgr.dev/chainguard/python:latest AS runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Chainguard runs as uid 65532 (nonroot)
COPY --from=builder --chown=65532:65532 /app/venv /app/venv
COPY --chown=65532:65532 app/ ./app/

USER 65532

EXPOSE 8000

# Override Chainguard python entrypoint — use the venv interpreter/binaries.
ENTRYPOINT ["/app/venv/bin/uvicorn"]
CMD ["app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
