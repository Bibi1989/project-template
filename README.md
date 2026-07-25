# Template GCP / GKE Boilerplate

FastAPI + Next.js on GKE, with NGINX Ingress, Secret Manager, and GitHub Actions.

> Project name is centralized in [`infra/config.env`](infra/config.env) (`NAME_PREFIX=template`). Keep Terraform `name_prefix` and Helm `global.namePrefix` matching that value.

## Layout

```text
frontend/     Next.js app + Dockerfile + CI workflow
backend/      FastAPI app + Dockerfile + CI workflow
infra/
  README.md   ← start here for infrastructure
  terraform/  GCP resources (GKE-focused IaC)
  helm/app/   Dynamic chart (`apps.*` → Deployment/Service/HPA) — local / GKE / EKS / AKS
```

## Quick start

### 1. Infrastructure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# set project_id, github_repository, alert_email

terraform init && terraform apply
```

Details and file map: [`infra/README.md`](infra/README.md)

### 2. GitHub Actions variables

| Variable | Terraform output |
|----------|------------------|
| `GCP_PROJECT_ID` | `project_id` |
| `GCP_REGION` | `region` |
| `GAR_REPOSITORY` | last segment of `artifact_registry_url` (e.g. `template-containers`) |
| `GKE_CLUSTER_NAME` | `gke_cluster_name` |
| `GKE_CLUSTER_LOCATION` | `gke_cluster_location` |
| `HELM_RELEASE_NAME` | `template-app` |
| `HELM_NAMESPACE` | `template` |
| `WIF_PROVIDER` | `wif_provider` |
| `WIF_SERVICE_ACCOUNT` | `wif_service_account` |

### 3. First app deploy

Step-by-step (build images, install, verify): [`infra/helm/app/README.md`](infra/helm/app/README.md)

```bash
eval "$(terraform -chdir=infra/terraform output -raw get_credentials_command)"

helm upgrade --install template-app infra/helm/app \
  --namespace template --create-namespace \
  --set global.projectId=$(terraform -chdir=infra/terraform output -raw project_id) \
  --set global.gcpServiceAccount=$(terraform -chdir=infra/terraform output -raw workload_app_service_account) \
  --set apps.frontend.image.repository=$(terraform -chdir=infra/terraform output -raw artifact_registry_url)/frontend \
  --set apps.backend.image.repository=$(terraform -chdir=infra/terraform output -raw artifact_registry_url)/backend
```

Pushes to `main` under `frontend/` or `backend/` build, push to Artifact Registry, and Helm-upgrade that service.

### 4. Local apps

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## Traffic

```text
Internet → GCP Load Balancer → ingress-nginx
              /      → frontend :3000
              /api/* → backend  :8000  (rewrite drops /api)
```

## What Terraform creates

| Piece | File |
|-------|------|
| VPC + NAT | `network.tf` |
| GKE + IAM | `gke.tf` |
| Artifact Registry | `registry.tf` |
| Secret Manager | `secrets.tf` |
| NGINX Ingress + CSI | `ingress.tf` |
| Alerts, log archive, backups | `ops.tf` |
| GitHub Actions WIF | `github.tf` |

## Security notes

- Change default `app_secrets` before production.
- Restrict GKE master authorized networks (currently open for bootstrap).
- Use a GCS backend for Terraform state (comment in `providers.tf`).
