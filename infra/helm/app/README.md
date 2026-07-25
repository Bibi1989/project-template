# template-app Helm chart

Deploys the **Next.js frontend** and **FastAPI backend** behind NGINX Ingress on **any Kubernetes** cluster. Cloud-specific pieces (images, secrets backend, identity) are selected with values files.


| Values file                              | Target                            | Images             | Secrets                              |
| ---------------------------------------- | --------------------------------- | ------------------ | ------------------------------------ |
| `values.yaml`                            | Local (Desktop / kind / minikube) | `template-*:local` | `provider: kubernetes`               |
| `values.yaml` + `values-production.yaml` | **GKE**                           | Artifact Registry  | `provider: csi` (GCP Secret Manager) |
| `values.yaml` + `values-aws.yaml`        | **EKS**                           | ECR                | `provider: kubernetes`               |
| `values.yaml` + `values-azure.yaml`      | **AKS**                           | ACR                | `provider: kubernetes`               |


> **Renaming:** set `NAME_PREFIX` in `[../../config.env](../../config.env)`, then mirror to Terraform `name_prefix` and Helm `global.namePrefix`. Release = `{NAME_PREFIX}-app`.

```text
Internet / localhost
   │
   ▼
ingress-nginx (or cloud ingress class)
   ├── /          → service-frontend :3000
   └── /api/(.*)  → service-backend  :8000   (rewrite drops /api)
```

---



## Secrets & ConfigMap



### Secrets — pick one provider

```yaml
secrets:
  enabled: true
  provider: kubernetes   # or: csi
```


| `secrets.provider` | Manifest                                                                                                     | Best for                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `kubernetes`       | `kind: Secret` (`[templates/secret.yaml](templates/secret.yaml)`)                                            | Local, EKS, AKS, any cluster |
| `csi`              | `kind: SecretProviderClass` (`[templates/secret-provider-class.yaml](templates/secret-provider-class.yaml)`) | GKE + GCP Secret Manager     |


- **kubernetes:** fill `secrets.stringData` (or override with `--set` / Sealed Secrets / SOPS — do not commit real prod passwords).
- **csi:** requires `global.projectId`, CSI driver + GCP provider, and Workload Identity (`global.gcpServiceAccount`). Keys come from `secrets.secretKeys` → Secret Manager.

Both modes sync into the same env Secret name (`{namePrefix}-app-env`) and are injected with `envFrom`. CSI also mounts files at `secrets.mountPath`.

### ConfigMap

```yaml
configMap:
  enabled: true
  envFrom: true          # inject all keys as env vars
  data:
    APP_NAME: template-api
    LOG_FORMAT: json
```

Creates `kind: ConfigMap` (`{namePrefix}-app-config`). Non-sensitive only — put credentials in Secret / CSI.

There is also a small logging ConfigMap when `logging.configMap.enabled` is true.

---



## Multi-cloud: what works where


| Capability                                | Local              | GKE        | EKS | AKS |
| ----------------------------------------- | ------------------ | ---------- | --- | --- |
| Deployments / Services / Ingress          | ✅                  | ✅          | ✅   | ✅   |
| HPA / PDB                                 | ✅ (off by default) | ✅          | ✅   | ✅   |
| ConfigMap                                 | ✅                  | ✅          | ✅   | ✅   |
| `secrets.provider: kubernetes`            | ✅                  | ✅          | ✅   | ✅   |
| `secrets.provider: csi` (GCP SM)          | ❌                  | ✅          | ❌*  | ❌*  |
| Google Managed Prometheus `PodMonitoring` | ❌                  | ✅          | ❌   | ❌   |
| Terraform under `infra/terraform/`        | —                  | ✅ GCP only | ❌   | ❌   |


AWS/Azure can use **Secrets Store CSI** with their own providers (ASM / Key Vault), but that is **not** wired in this chart yet. Use `provider: kubernetes` (or External Secrets Operator) until you extend `secret-provider-class.yaml`.

**IaC note:** `infra/terraform/` provisions **GCP only** (VPC, GKE, GAR, WIF, …). For AWS/Azure, bring your own cluster/registry (or add separate Terraform later) and deploy this Helm chart with the matching values file.

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

# kind only:
kind load docker-image template-frontend:local -n template
kind load docker-image template-backend:local -n template
```



### 2. Install (`values.yaml` only)

```bash
cd infra/helm/app

helm upgrade --install template-app . \
  --namespace template \
  --create-namespace \
  --wait

helm upgrade template-app . -n template
```

Defaults: local image tags, `secrets.provider: kubernetes`, ConfigMap on, HPA/PDB/PodMonitoring off, `imagePullPolicy: Never`.

**Postgres from pods:** `DATABASE_URL` must not use `localhost` (that is the pod). Local defaults use `host.docker.internal:5420` so kind / Docker Desktop can reach Postgres on your machine. Keep `frontend/.env` on `localhost:5420` for `npm run dev` on the host.

### 3. Open the app

**Via ingress** (paths `/` and `/api` as in production):

```bash
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
# then open http://localhost:8080
```

**Via services** (direct to a pod’s service):

```bash
kubectl port-forward -n template svc/service-frontend 3000:3000
# then open http://localhost:3000

# optional API-only:
kubectl port-forward -n template svc/service-backend 8000:8000
```



### 4. Upgrade / force a rolling restart

After rebuilding local images (same tag), bump `rolloutDate` so pods restart and pick up the new image:

```bash
cd infra/helm/app

helm upgrade template-app . -n template --set rolloutDate="$(date +%s)"
```

```bash
# Restart specific deployments
kubectl rollout restart deployment deployment-frontend -n template
kubectl rollout restart deployment deployment-backend -n template
```

Or reinstall with wait:

```bash
helm upgrade --install template-app . \
  --namespace template \
  --set rolloutDate="$(date +%s)" \
  --wait
```



## GKE (GCP production)



### Prerequisites

Terraform applied (`infra/terraform`), `gcloud`, `kubectl`, `helm`, Docker.

```bash
cd infra/terraform
eval "$(terraform output -raw get_credentials_command)"
```



### Build & push (Artifact Registry)

```bash
REGION=$(terraform output -raw region)
REGISTRY=$(terraform output -raw artifact_registry_url)
TAG=$(git rev-parse HEAD)

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
docker build -t "${REGISTRY}/backend:${TAG}" ../../backend && docker push "${REGISTRY}/backend:${TAG}"
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=/api \
  -t "${REGISTRY}/frontend:${TAG}" ../../frontend && docker push "${REGISTRY}/frontend:${TAG}"
```



### Install

```bash
PROJECT=$(terraform output -raw project_id)
REGISTRY=$(terraform output -raw artifact_registry_url)
GCP_SA=$(terraform output -raw workload_app_service_account)
TAG=$(git rev-parse HEAD)

helm upgrade --install template-app ../helm/app \
  --namespace template --create-namespace --wait --timeout 10m \
  -f ../helm/app/values.yaml \
  -f ../helm/app/values-production.yaml \
  --set global.projectId="${PROJECT}" \
  --set global.gcpServiceAccount="${GCP_SA}" \
  --set frontend.image.repository="${REGISTRY}/frontend" \
  --set frontend.image.tag="${TAG}" \
  --set backend.image.repository="${REGISTRY}/backend" \
  --set backend.image.tag="${TAG}"
```

`values-production.yaml` sets `secrets.provider: csi` and GAR image paths.

---



## AWS (EKS)

1. Create EKS + ECR (your own IaC / Console).
2. Install ingress-nginx (or AWS LB Controller) and set `ingress.className` if needed.
3. Push images to ECR; install with the AWS values file:

```bash
ECR="<account>.dkr.ecr.<region>.amazonaws.com"
TAG=$(git rev-parse HEAD)

helm upgrade --install template-app . \
  --namespace template --create-namespace --wait \
  -f values.yaml -f values-aws.yaml \
  --set frontend.image.repository="${ECR}/template-frontend" \
  --set frontend.image.tag="${TAG}" \
  --set backend.image.repository="${ECR}/template-backend" \
  --set backend.image.tag="${TAG}" \
  --set secrets.stringData.DATABASE_URL="postgresql://..." \
  --set secrets.stringData.API_SECRET_KEY="..."
```

Optional: annotate the chart ServiceAccount for **IRSA** (see comments in `values-aws.yaml`).

---



## Azure (AKS)

1. Create AKS + ACR; grant the kubelet / kubelet identity `AcrPull`.
2. Install ingress-nginx (or AGIC).
3. Push images to ACR; install:

```bash
ACR="myregistry.azurecr.io"
TAG=$(git rev-parse HEAD)

helm upgrade --install template-app . \
  --namespace template --create-namespace --wait \
  -f values.yaml -f values-azure.yaml \
  --set frontend.image.repository="${ACR}/template-frontend" \
  --set frontend.image.tag="${TAG}" \
  --set backend.image.repository="${ACR}/template-backend" \
  --set backend.image.tag="${TAG}" \
  --set secrets.stringData.DATABASE_URL="postgresql://..." \
  --set secrets.stringData.API_SECRET_KEY="..."
```

Optional: Azure Workload Identity annotations on `serviceAccount` (see `values-azure.yaml`).

---



## Verify

```bash
kubectl -n template get pods,svc,ingress,secret,configmap
kubectl -n template get secretproviderclass   # only when provider=csi
kubectl -n template logs -l app.kubernetes.io/component=frontend --tail=50
kubectl -n template logs -l app.kubernetes.io/component=backend --tail=50
```



## Debugging pods



### Status & events

```bash
# Overview — look for CrashLoopBackOff, ImagePullBackOff, Pending, Error
kubectl -n template get pods -o wide

# Why a pod is stuck (events, probes, mounts, pull errors)
kubectl -n template describe pod -l app.kubernetes.io/component=frontend
kubectl -n template describe pod -l app.kubernetes.io/component=backend

# Namespace events (newest last)
kubectl -n template get events --sort-by='.lastTimestamp'
```



### Logs

```bash
# Current container
kubectl -n template logs -l app.kubernetes.io/component=frontend --tail=100
kubectl -n template logs -l app.kubernetes.io/component=backend --tail=100

# Follow live
kubectl -n template logs -l app.kubernetes.io/component=frontend -f

# Previous crash (CrashLoopBackOff)
kubectl -n template logs -l app.kubernetes.io/component=backend --previous --tail=100

# All containers in a multi-container pod (if any)
kubectl -n template logs <pod-name> --all-containers --tail=100
```



### Shell / probes

```bash
POD=$(kubectl -n template get pod -l app.kubernetes.io/component=frontend -o jsonpath='{.items[0].metadata.name}')

# Exec into the container
kubectl -n template exec -it "$POD" -- sh

# Hit health endpoints from inside the cluster
kubectl -n template exec "$POD" -- wget -qO- http://127.0.0.1:3000/ || true
kubectl -n template exec deploy/deployment-backend -- wget -qO- http://127.0.0.1:8000/health || true
```



### Workloads & config

```bash
kubectl -n template get deploy,rs,svc,ingress
kubectl -n template rollout status deploy/deployment-frontend
kubectl -n template rollout status deploy/deployment-backend
kubectl -n template rollout history deploy/deployment-frontend

# Env / mounts the pod actually received
kubectl -n template get pod "$POD" -o yaml | less
kubectl -n template get secret,configmap
```



### Common symptoms


| Symptom                     | Check                                                       |
| --------------------------- | ----------------------------------------------------------- |
| `ErrImageNeverPull` (local) | Rebuild; `kind load`; tag matches `values.yaml`             |
| `ImagePullBackOff` (cloud)  | Wrong registry/tag; node pull rights (GAR/ECR/ACR)          |
| `CrashLoopBackOff`          | `logs --previous`; bad env/secret; app crash on boot        |
| `Pending`                   | `describe pod` → scheduling, PVC, resource requests         |
| DB disconnected / `ECONNREFUSED` | Pod `localhost` ≠ host. Use `host.docker.internal:5420` (kind / Docker Desktop) or in-cluster Postgres |
| Pods wait on CSI            | Only use `provider: csi` on GKE with driver + WI configured |
| Missing env vars            | `secrets.enabled` / `configMap.envFrom`; `describe pod`     |
| `503` from ingress          | Readiness probes failing; `get pods` not Ready              |
| Probe failures              | `describe pod` Events; hit `/` or `/health` via `exec`      |


```bash
# Render manifests (no cluster needed)
helm template template-app .                                    # local
helm template template-app . -f values.yaml -f values-aws.yaml
helm template template-app . -f values.yaml -f values-azure.yaml
helm template template-app . -f values.yaml -f values-production.yaml \
  --set global.projectId=demo --set global.gcpServiceAccount=demo@demo.iam.gserviceaccount.com
```



## Day-2

```bash
# New image tag
helm upgrade template-app . -n template --reuse-values --set backend.image.tag="${TAG}" --wait

# Same tag / local images — force pods to restart
helm upgrade template-app . -n template --set rolloutDate="$(date +%s)"

helm uninstall template-app -n template
```



## Chart layout

```text
helm/app/
├── values.yaml               # local defaults
├── values-production.yaml    # GKE / GCP
├── values-aws.yaml           # EKS / ECR example
├── values-azure.yaml         # AKS / ACR example
├── Chart.yaml
├── README.md
└── templates/
    ├── secret.yaml                 # kind: Secret
    ├── secret-provider-class.yaml  # kind: SecretProviderClass
    ├── configmap.yaml              # kind: ConfigMap (app)
    ├── logging-configmap.yaml
    ├── deployment-*.yaml
    ├── service-*.yaml
    ├── ingress.yaml
    └── …
```



## Important values


| Value                                  | Purpose                                      |
| -------------------------------------- | -------------------------------------------- |
| `secrets.provider`                     | `kubernetes` or `csi`                        |
| `secrets.stringData`                   | Native Secret payload                        |
| `secrets.secretKeys`                   | CSI → Secret Manager key map                 |
| `configMap.data` / `configMap.envFrom` | App ConfigMap                                |
| `frontend.image.*` / `backend.image.*` | Registry + tag                               |
| `global.namePrefix`                    | Name prefix (sync with `config.env`)         |
| `global.projectId`                     | Required for `csi`                           |
| `global.gcpServiceAccount`             | GKE Workload Identity only                   |
| `ingress.className`                    | `nginx` by default; change for AGIC / ALB    |
| `rolloutDate`                          | Bump with `--set` to force a rolling restart |


