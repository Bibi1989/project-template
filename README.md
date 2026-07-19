# Turnkey GCP / GKE Multi-Tenant Boilerplate

Production-ready monorepo template: **FastAPI** backend + **Next.js** frontend, provisioned on **GCP (VPC, GAR, GKE, Secret Manager)** with **ingress-nginx** as the edge reverse proxy, and per-service GitHub Actions deploys via Workload Identity Federation.

## Repository layout

```text
├── frontend/
│   ├── Dockerfile
│   ├── src/app/                    # Next.js App Router
│   └── .github/workflows/deploy-frontend.yml
├── backend/
│   ├── Dockerfile
│   ├── app/main.py                 # FastAPI
│   └── .github/workflows/deploy-backend.yml
├── .github/workflows/              # Active GitHub Actions entrypoints (mirrors service workflows)
│   ├── deploy-frontend.yml
│   └── deploy-backend.yml
└── infra/
    ├── terraform/                  # VPC, GAR, GKE (+ CSI), Secret Manager, ingress-nginx, WIF
    └── helm/app/                   # Dual-service chart, SecretProviderClass, Ingress routing
```

> GitHub only discovers workflows under the repository-root `.github/workflows/`. Service-owned copies live under `frontend/` and `backend/` for ownership clarity; both are kept in sync.

## Traffic path

```text
Internet
   │
   ▼
GCP External Network Load Balancer   ← created by ingress-nginx Service type=LoadBalancer
   │
   ▼
ingress-nginx (ingressClassName: nginx)
   ├── /          → service-frontend:3000  (Next.js)
   └── /api/(.*)  → service-backend:8000   (FastAPI, rewrite /$1 drops /api)
```

## Quick start

### 1. Provision infrastructure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit project_id, github_repository, and secrets

terraform init
terraform apply
```

Key outputs:

| Output | Use |
|--------|-----|
| `artifact_registry_url` | Docker push base |
| `gke_cluster_name` / `gke_cluster_location` | CI vars |
| `secret_resource_names` | SecretProviderClass |
| `wif_provider_resource_name` | `vars.WIF_PROVIDER` |
| `wif_service_account_email` | `vars.WIF_SERVICE_ACCOUNT` |
| `workload_app_service_account` | Helm `global.gcpServiceAccount` |

Fetch kubeconfig:

```bash
eval "$(terraform output -raw get_credentials_command)"
```

### 2. Configure GitHub Actions variables

Repository → Settings → Variables (and Environments → `production`):

| Variable | Example |
|----------|---------|
| `GCP_PROJECT_ID` | `my-gcp-project` |
| `GCP_REGION` | `us-central1` |
| `GAR_REPOSITORY` | `turnkey-containers` |
| `GKE_CLUSTER_NAME` | `turnkey-gke` |
| `GKE_CLUSTER_LOCATION` | `us-central1` |
| `HELM_RELEASE_NAME` | `turnkey-app` |
| `HELM_NAMESPACE` | `turnkey` |
| `WIF_PROVIDER` | `//iam.googleapis.com/projects/.../providers/github-actions-provider` |
| `WIF_SERVICE_ACCOUNT` | `turnkey-github-actions@PROJECT.iam.gserviceaccount.com` |

### 3. Initial Helm install (once)

```bash
helm upgrade --install turnkey-app infra/helm/app \
  --namespace turnkey --create-namespace \
  --set global.projectId=YOUR_PROJECT \
  --set global.gcpServiceAccount=$(cd infra/terraform && terraform output -raw workload_app_service_account) \
  --set frontend.image.repository=$(cd infra/terraform && terraform output -raw artifact_registry_url)/frontend \
  --set backend.image.repository=$(cd infra/terraform && terraform output -raw artifact_registry_url)/backend \
  --set frontend.image.tag=bootstrap \
  --set backend.image.tag=bootstrap
```

Subsequent pushes to `main` under `frontend/**` or `backend/**` build, push SHA-tagged images to GAR, and run `helm upgrade` with `--reuse-values`.

### 4. Local development

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## Terraform stack

| Resource | Purpose |
|----------|---------|
| Custom VPC + private subnet + Cloud NAT | Isolated private GKE nodes |
| Artifact Registry (Docker) | Frontend/backend images |
| GKE (regional) | `secrets_store_csi_driver_config.enabled = true`, Workload Identity, network policy |
| Secret Manager + IAM | App secrets; `roles/secretmanager.secretAccessor` on node + workload SAs |
| Helm `ingress-nginx` | Edge reverse proxy → external GCP LB |
| Helm GCP CSI provider | Secret Manager → pod mounts |
| WIF pool/provider | Keyless GitHub Actions → GCP |

## Helm chart (`infra/helm/app`)

- `SecretProviderClass` — GCP provider; syncs to K8s Secret for `envFrom`
- `deployment-frontend.yaml` / `deployment-backend.yaml` — probes, resources, CSI volume
- `service-frontend.yaml` (ClusterIP `:3000`) / `service-backend.yaml` (ClusterIP `:8000`)
- `ingress.yaml` — `ingressClassName: nginx`, `/` → frontend, `/api/*` → backend with `rewrite-target: /$1`

## Security notes

- Replace default `app_secrets` before production apply.
- Tighten `gke_master_authorized_cidrs` (remove `0.0.0.0/0`).
- Prefer private master endpoint + bastion/VPN for hardened clusters.
- Store Terraform state in a GCS backend (commented block in `providers.tf`).

## License

MIT — adapt freely as a GitHub template repository.
