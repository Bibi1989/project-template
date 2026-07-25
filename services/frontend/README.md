# Frontend (Next.js)

Next.js 15 App Router UI. Lives under `services/frontend`. Talks to the FastAPI
backend via `BACKEND_URL` (server) and `/api` (browser / ingress).

## Prerequisites

- Node.js **22** (see `.nvmrc`; avoid Node 23 for lockfile/CI — npm 11 can omit `@emnapi/*`)
- npm 10 (ships with Node 22)
- Optional: Postgres for the database health check (`DATABASE_URL`)
- Backend running on `:8000` (see [`../backend/README.md`](../backend/README.md))

## Install

```bash
cd services/frontend

# recommended: match CI
nvm use   # reads .nvmrc → 22.x

npm install

cp .env.example .env               # adjust ports / DB as needed
```

When changing dependencies, run `npm install` under **Node 22** and commit
`package.json` + `package-lock.json` together. Do not regenerate the lockfile
on Node 23 if you want Linux CI `npm ci` to stay green.

## Start (local)

```bash
cd services/frontend
npm run dev
```

- App: http://127.0.0.1:3000  
- Setup guide (blog): http://127.0.0.1:3000/blog  

```bash
npm run build
npm run start
npm run lint
npm test
```

## Environment

| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXT_PUBLIC_APP_URL` | Public origin | `http://127.0.0.1:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | Browser API prefix | `/api` |
| `BACKEND_URL` | Absolute FastAPI base for RSC | `http://127.0.0.1:8000` |
| `DATABASE_URL` | Postgres for DB health | `postgresql://postgres:postgres@localhost:5420/postgres` |

- **`BACKEND_URL` must be absolute** for server-side fetch.
- On the host use `localhost`; in Kubernetes pods use `host.docker.internal`.

## Docker

```bash
# From repo root
docker build -t template-frontend:local \
  --build-arg NEXT_PUBLIC_API_BASE_URL=/api \
  services/frontend

docker run --rm -p 3000:3000 \
  -e BACKEND_URL=http://host.docker.internal:8000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5420/postgres \
  template-frontend:local
```

## Kubernetes

```bash
# After docker build + kind load
helm upgrade --install template-app infra/helm/app \
  -n template --create-namespace --wait

kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
```

Chart details: [`../../infra/helm/app/README.md`](../../infra/helm/app/README.md).
