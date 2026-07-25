# template-app Helm chart

Workloads come from **`apps.*`** in values. Shared templates render a Deployment, Service, and optional HPA / PDB / PodMonitoring for each enabled key. Ingress paths point at an `apps` key (skipped when that app is disabled).

| Values file | Target | Images | Secrets |
|-------------|--------|--------|---------|
| `values.yaml` | Local (Desktop / kind / minikube) | `template-*:local` | `provider: kubernetes` |
| `values.yaml` + `values-production.yaml` | **GKE** | Artifact Registry | `provider: csi` |
| `values.yaml` + `values-aws.yaml` | **EKS** | ECR | `provider: kubernetes` |
| `values.yaml` + `values-azure.yaml` | **AKS** | ACR | `provider: kubernetes` |

> **Renaming:** set `NAME_PREFIX` in [`../../config.env`](../../config.env), then mirror to Terraform `name_prefix` and Helm `global.namePrefix`. Release = `{NAME_PREFIX}-app`.

```text
Internet / localhost
   │
   ▼
ingress-nginx
   ├── /?(.*)          → apps.frontend  (service-frontend :3000)
   └── /api(?:/|$)(.*) → apps.backend   (service-backend  :8000, rewrite /$1)
```

---

## Apps (dynamic workloads)

Add or remove keys under `apps` — no new templates required:

```yaml
apps:
  frontend:
    enabled: true
    name: deployment-frontend
    replicaCount: 1
    image:
      repository: template-frontend
      tag: local
      pullPolicy: Never
    service:
      name: service-frontend
      type: ClusterIP
      port: 3000
      targetPort: 3000
    probes: { liveness: { path: / }, readiness: { path: / } }
    env: []
    autoscaling:
      enabled: false
      minReplicas: 1
      maxReplicas: 3
      targetCPUUtilizationPercentage: 70
      targetMemoryUtilizationPercentage: 80
    podDisruptionBudget:
      enabled: false
      minAvailable: 1
    monitoring:
      scrape: true
      path: /metrics
      podMonitoring: false
    readOnlyRootFilesystem: false
    emptyDirTmp: false

  backend:
    enabled: false   # true in values-production / aws / azure
    name: deployment-backend
    # …same shape as frontend
```

Global gates (must be on **and** per-app flag):

| Gate | Per-app |
|------|---------|
| `autoscaling.enabled` | `apps.<name>.autoscaling.enabled` |
| `podDisruptionBudget.enabled` | `apps.<name>.podDisruptionBudget.enabled` |
| `monitoring.podMonitoring.enabled` | `apps.<name>.monitoring.podMonitoring` |

Ingress resolves `paths[].app` → that app’s Service:

```yaml
ingress:
  paths:
    - path: /api(?:/|$)(.*)
      pathType: ImplementationSpecific
      app: backend
    - path: /?(.*)
      pathType: ImplementationSpecific
      app: frontend
```

Image overrides:

```bash
--set apps.frontend.image.repository=… --set apps.frontend.image.tag=…
--set apps.backend.enabled=true
```

---

## Secrets & ConfigMap

### Secrets

```yaml
secrets:
  enabled: true
  provider: kubernetes   # or: csi
```

| `secrets.provider` | Manifest | Best for |
|--------------------|----------|----------|
| `kubernetes` | [`templates/secret.yaml`](templates/secret.yaml) | Local, EKS, AKS |
| `csi` | [`templates/secret-provider-class.yaml`](templates/secret-provider-class.yaml) | GKE + Secret Manager |

Both inject `{namePrefix}-app-env` via `envFrom`. CSI also mounts `secrets.mountPath`.

### ConfigMap

```yaml
configMap:
  enabled: true
  envFrom: true
  data:
    APP_NAME: template-api
    LOG_FORMAT: json
```

---

## Multi-cloud

| Capability | Local | GKE | EKS | AKS |
|------------|-------|-----|-----|-----|
| Deployments / Services / Ingress | ✅ | ✅ | ✅ | ✅ |
| HPA / PDB | ✅ (off) | ✅ | ✅ | ✅ |
| `secrets.provider: kubernetes` | ✅ | ✅ | ✅ | ✅ |
| `secrets.provider: csi` (GCP) | ❌ | ✅ | ❌ | ❌ |
| GMP `PodMonitoring` | ❌ | ✅ | ❌ | ❌ |
| `infra/terraform/` | — | ✅ GCP | ❌ | ❌ |

Terraform under `infra/terraform/` is **GCP only**. For EKS/AKS, bring your own cluster and use the matching values file.

---

## Local Kubernetes

### Prerequisites

- Docker Desktop Kubernetes, kind, or minikube
- `kubectl`, `helm` ≥ 3.14, Docker
- Optional: ingress-nginx

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  -n ingress-nginx --create-namespace
```

### 1. Build local images

```bash
# From repo root
docker build -t template-frontend:local \
  --build-arg NEXT_PUBLIC_API_BASE_URL=/api \
  frontend

docker build -t template-backend:local backend

# kind:
kind load docker-image template-frontend:local -n template
kind load docker-image template-backend:local -n template
```

### 2. Install

```bash
cd infra/helm/app

helm upgrade --install template-app . \
  --namespace template \
  --create-namespace \
  --wait
```

Defaults: `apps.frontend` only (`backend` off), local tags, `secrets.provider: kubernetes`, HPA/PDB off, `imagePullPolicy: Never`.

Enable the API locally:

```bash
helm upgrade template-app . -n template --set apps.backend.enabled=true --wait
```

**Postgres from pods:** do not use `localhost` in `DATABASE_URL` (that is the pod). Local values use `host.docker.internal:5420`. Keep `frontend/.env` on `localhost:5420` for `npm run dev` on the host.

### 3. Open the app

**Ingress** (same path routing as production):

```bash
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
# http://localhost:8080
```

**Service:**

```bash
kubectl port-forward -n template svc/service-frontend 3000:3000
# http://localhost:3000

# if backend enabled:
kubectl port-forward -n template svc/service-backend 8000:8000
```

### 4. Upgrade / force restart

After rebuilding the same local tag:

```bash
cd infra/helm/app
helm upgrade template-app . -n template --set rolloutDate="$(date +%s)" --wait
```

Or restart one workload:

```bash
kubectl rollout restart deployment/deployment-frontend -n template
```

---

## GKE (production)

```bash
cd infra/terraform
eval "$(terraform output -raw get_credentials_command)"

REGION=$(terraform output -raw region)
REGISTRY=$(terraform output -raw artifact_registry_url)
TAG=$(git rev-parse HEAD)

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
docker build -t "${REGISTRY}/backend:${TAG}" ../../backend && docker push "${REGISTRY}/backend:${TAG}"
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=/api \
  -t "${REGISTRY}/frontend:${TAG}" ../../frontend && docker push "${REGISTRY}/frontend:${TAG}"

PROJECT=$(terraform output -raw project_id)
GCP_SA=$(terraform output -raw workload_app_service_account)

helm upgrade --install template-app ../helm/app \
  --namespace template --create-namespace --wait --timeout 10m \
  -f ../helm/app/values.yaml \
  -f ../helm/app/values-production.yaml \
  --set global.projectId="${PROJECT}" \
  --set global.gcpServiceAccount="${GCP_SA}" \
  --set apps.frontend.image.repository="${REGISTRY}/frontend" \
  --set apps.frontend.image.tag="${TAG}" \
  --set apps.backend.image.repository="${REGISTRY}/backend" \
  --set apps.backend.image.tag="${TAG}"
```

`values-production.yaml` turns on `apps.backend`, HPA, PDB, and `secrets.provider: csi`.

---

## AWS (EKS)

```bash
ECR="<account>.dkr.ecr.<region>.amazonaws.com"
TAG=$(git rev-parse HEAD)

helm upgrade --install template-app . \
  --namespace template --create-namespace --wait \
  -f values.yaml -f values-aws.yaml \
  --set apps.frontend.image.repository="${ECR}/template-frontend" \
  --set apps.frontend.image.tag="${TAG}" \
  --set apps.backend.image.repository="${ECR}/template-backend" \
  --set apps.backend.image.tag="${TAG}" \
  --set secrets.stringData.DATABASE_URL="postgresql://..." \
  --set secrets.stringData.API_SECRET_KEY="..."
```

Optional IRSA annotations: see `values-aws.yaml`.

---

## Azure (AKS)

```bash
ACR="myregistry.azurecr.io"
TAG=$(git rev-parse HEAD)

helm upgrade --install template-app . \
  --namespace template --create-namespace --wait \
  -f values.yaml -f values-azure.yaml \
  --set apps.frontend.image.repository="${ACR}/template-frontend" \
  --set apps.frontend.image.tag="${TAG}" \
  --set apps.backend.image.repository="${ACR}/template-backend" \
  --set apps.backend.image.tag="${TAG}" \
  --set secrets.stringData.DATABASE_URL="postgresql://..." \
  --set secrets.stringData.API_SECRET_KEY="..."
```

Optional Workload Identity: see `values-azure.yaml`.

---

## Verify

```bash
kubectl -n template get pods,svc,ingress,secret,configmap,hpa,pdb
kubectl -n template get secretproviderclass   # provider=csi only
kubectl -n template logs -l app.kubernetes.io/component=frontend --tail=50
kubectl -n template logs -l app.kubernetes.io/component=backend --tail=50
```

---

## Debugging pods

### Status & events

```bash
kubectl -n template get pods -o wide
kubectl -n template describe pod -l app.kubernetes.io/component=frontend
kubectl -n template describe pod -l app.kubernetes.io/component=backend
kubectl -n template get events --sort-by='.lastTimestamp'
```

### Logs

```bash
kubectl -n template logs -l app.kubernetes.io/component=frontend --tail=100
kubectl -n template logs -l app.kubernetes.io/component=backend --tail=100 -f
kubectl -n template logs -l app.kubernetes.io/component=backend --previous --tail=100
```

### Shell / probes

```bash
POD=$(kubectl -n template get pod -l app.kubernetes.io/component=frontend \
  -o jsonpath='{.items[0].metadata.name}')

kubectl -n template exec -it "$POD" -- sh
kubectl -n template exec "$POD" -- wget -qO- http://127.0.0.1:3000/ || true
kubectl -n template exec deploy/deployment-backend -- wget -qO- http://127.0.0.1:8000/health || true
```

### Workloads

```bash
kubectl -n template get deploy,rs,svc,ingress,hpa
kubectl -n template rollout status deploy/deployment-frontend
kubectl -n template get pod "$POD" -o yaml | less
```

### Common symptoms

| Symptom | Check |
|---------|--------|
| `ErrImageNeverPull` (local) | Rebuild; `kind load`; tag matches `apps.*.image` |
| `ImagePullBackOff` (cloud) | Registry/tag; node pull rights |
| `CrashLoopBackOff` | `logs --previous`; env/secret; boot crash |
| `Pending` | `describe pod` → scheduling / resources |
| DB disconnected / `ECONNREFUSED` | Use `host.docker.internal:5420` from pods, not `localhost` |
| No backend / `/api` 404 | `apps.backend.enabled=true` (or production values) |
| Pods wait on CSI | `provider: csi` only on GKE with driver + WI |
| `503` from ingress | Readiness; `get pods` not Ready |

```bash
helm template template-app .                                    # local
helm template template-app . -f values.yaml -f values-aws.yaml
helm template template-app . -f values.yaml -f values-azure.yaml
helm template template-app . -f values.yaml -f values-production.yaml \
  --set global.projectId=demo --set global.gcpServiceAccount=demo@demo.iam.gserviceaccount.com
```

---

## Day-2

```bash
# New image tag
helm upgrade template-app . -n template --reuse-values \
  --set apps.backend.image.tag="${TAG}" --wait

# Same tag — force restart
helm upgrade template-app . -n template --set rolloutDate="$(date +%s)"

helm uninstall template-app -n template
```

---

## Chart layout

```text
helm/app/
├── values.yaml                 # apps.* local defaults
├── values-production.yaml      # GKE
├── values-aws.yaml             # EKS
├── values-azure.yaml           # AKS
├── Chart.yaml
├── README.md
└── templates/
    ├── deployment.yaml         # range apps.*
    ├── service.yaml
    ├── hpa.yaml
    ├── pdb.yaml
    ├── podmonitoring.yaml
    ├── ingress.yaml            # paths[].app → apps.*
    ├── secret.yaml
    ├── secret-provider-class.yaml
    ├── configmap.yaml
    ├── logging-configmap.yaml
    ├── serviceaccount.yaml
    └── NOTES.txt
```

---

## Important values

| Value | Purpose |
|-------|---------|
| `apps.<name>` | Workload (`enabled`, image, service, probes, env, …) |
| `apps.<name>.autoscaling` | Per-app HPA (+ `autoscaling.enabled`) |
| `apps.<name>.podDisruptionBudget` | Per-app PDB (+ `podDisruptionBudget.enabled`) |
| `ingress.paths[].app` | Which `apps.*` Service backs the path |
| `secrets.provider` | `kubernetes` or `csi` |
| `configMap.data` | Non-sensitive env |
| `global.namePrefix` | Sync with `config.env` |
| `global.projectId` / `gcpServiceAccount` | Required for CSI / WI |
| `rolloutDate` | `--set` to force rolling restart |
