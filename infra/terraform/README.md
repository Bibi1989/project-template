# Terraform (GCP / GKE) — modular

Root module wires small modules. Same inputs/outputs as before.

```text
terraform/
├── main.tf                 # module calls
├── variables.tf            # project_id, region, name_prefix, …
├── locals.tf
├── providers.tf
├── versions.tf
├── outputs.tf
├── moved.tf                # state migration from flat → modules
├── terraform.tfvars.example
└── modules/
    ├── apis/               # enable GCP APIs
    ├── network/            # VPC, subnet, NAT, LB health firewall
    ├── gke/                # cluster, node pool, workload identity SA
    ├── registry/           # Artifact Registry
    ├── secrets/            # Secret Manager + IAM
    ├── github_wif/         # GitHub Actions WIF
    ├── ops/                # alerts, log sink, Backup for GKE
    └── addons/             # ingress-nginx + Secret CSI (Helm)
```

## Apply

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# edit project_id, github_repository, alert_email

terraform init
terraform plan
terraform apply
```

If you already applied the **old flat** layout, `moved.tf` remaps state into modules — run `terraform plan` and expect mostly **no destroy** of existing resources.

## Outputs (unchanged)

`gke_cluster_name`, `artifact_registry_url`, `workload_app_service_account`,
`wif_provider`, `wif_service_account`, `get_credentials_command`, …
