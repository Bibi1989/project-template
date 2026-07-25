# Infrastructure (`infra/`)

| Path | What it does |
|------|----------------|
| `config.env` | **Single place** for `NAME_PREFIX` (default `template`) |
| `terraform/` | **GCP only** — VPC, GKE, GAR, Secret Manager, ingress-nginx, WIF |
| `helm/app/` | App chart — works on **local / GKE / EKS / AKS** via values files |
| `helm/monitoring/` | Prometheus + Grafana (`kube-prometheus-stack`) → ns `template-monitoring` |
| `helm/argocd/` | Argo CD GitOps → ns `template-argocd` |

> Rename once: edit `NAME_PREFIX` in `config.env`, then set Terraform `name_prefix` and Helm `global.namePrefix` to the same value.

**Helm multi-cloud:** see [`helm/app/README.md`](helm/app/README.md) (`values-aws.yaml`, `values-azure.yaml`, `secrets.provider: kubernetes` vs `csi`).

```text
Internet
   │
   ▼
Load Balancer  ←  ingress-nginx (installed by Terraform)
   │
   ├── /      → frontend :3000
   └── /api/* → backend  :8000
                    │
                    ▼
              Secret Manager (via CSI)
```

## Apply (Terraform)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit: project_id, github_repository, alert_email

terraform init
terraform apply
```

You only need to set a handful of values — see `terraform.tfvars.example`.

## Deploy the app (Helm)

Full guide (images, install, verify, day-2): **[`helm/app/README.md`](helm/app/README.md)**

```bash
eval "$(terraform -chdir=terraform output -raw get_credentials_command)"

helm upgrade --install template-app ./helm/app \
  --namespace template --create-namespace \
  --set global.projectId=$(terraform -chdir=terraform output -raw project_id) \
  --set global.gcpServiceAccount=$(terraform -chdir=terraform output -raw workload_app_service_account) \
  --set apps.frontend.image.repository=$(terraform -chdir=terraform output -raw artifact_registry_url)/frontend \
  --set apps.backend.image.repository=$(terraform -chdir=terraform output -raw artifact_registry_url)/backend
```

## Monitoring (Prometheus + Grafana)

Local / any cluster: **[`helm/monitoring/README.md`](helm/monitoring/README.md)** — installs into namespace `template-monitoring`.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install template-monitoring prometheus-community/kube-prometheus-stack \
  -n template-monitoring --create-namespace \
  -f helm/monitoring/values.yaml --wait
```

## Argo CD (GitOps)

**[`helm/argocd/README.md`](helm/argocd/README.md)** — installs into namespace `template-argocd`.

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm upgrade --install template-argocd argo/argo-cd \
  -n template-argocd --create-namespace \
  -f helm/argocd/values.yaml --wait
```

## Terraform file map

Read them top-to-bottom in this order:

| File | Responsibility |
|------|----------------|
| `providers.tf` | Terraform + GCP/Helm providers |
| `variables.tf` | The few inputs you configure |
| `network.tf` | VPC, subnet, NAT, firewall |
| `gke.tf` | GKE cluster, nodes, service accounts |
| `registry.tf` | Artifact Registry (Docker images) |
| `secrets.tf` | Secret Manager + IAM |
| `ingress.tf` | NGINX Ingress + Secret CSI provider |
| `ops.tf` | Monitoring alert, log export, Backup for GKE |
| `github.tf` | Workload Identity for GitHub Actions |
| `outputs.tf` | Values CI and Helm need |
