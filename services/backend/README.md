# Backend (FastAPI)

Python API under `services/backend`. In Kubernetes, ingress rewrites `/api/*` → this service at `/`.

## Prerequisites

- Python **3.11–3.14** (3.12 recommended; Docker image uses 3.12)
- Optional: Postgres if you wire `DATABASE_URL`

```bash
brew install python@3.12   # optional on macOS
```

## Install

```bash
cd services/backend

python3 -m venv .venv                 # or: python3.12 -m venv .venv
source .venv/bin/activate             # Windows: .venv\Scripts\activate

pip install --upgrade pip
pip install -r requirements.txt -r requirements-dev.txt

cp .env.example .env
```

## Test & lint

```bash
cd services/backend
source .venv/bin/activate
ruff check app tests
pytest -q
```

Recreate a broken venv:

```bash
deactivate 2>/dev/null || true
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Start (local)

```bash
cd services/backend
source .venv/bin/activate

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- App: http://127.0.0.1:8000  
- Health: http://127.0.0.1:8000/health  
- Metrics: http://127.0.0.1:8000/metrics  
- OpenAPI: http://127.0.0.1:8000/docs  

## Docker

```bash
# From repo root
docker build -t template-backend:local services/backend
docker run --rm -p 8000:8000 --env-file services/backend/.env template-backend:local
```

## Kubernetes

```bash
helm upgrade template-app infra/helm/app -n template \
  --set apps.backend.enabled=true --wait
```

Chart details: [`../../infra/helm/app/README.md`](../../infra/helm/app/README.md).
