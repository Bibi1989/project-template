export type TerraformDocPage = {
  slug: string;
  title: string;
  blurb: string;
  path: string;
  what: string;
  why: string;
  provisions: string[];
  examples: { title: string; code: string }[];
  notes?: string[];
};

export const TERRAFORM_ROOT_PAGES: TerraformDocPage[] = [
  {
    slug: "main",
    title: "main.tf \u2014 root wiring",
    blurb: "Calls every module in dependency order.",
    path: "infra/terraform/main.tf",
    what: "The root module does not create GCP resources directly. It wires focused child modules and passes outputs from one into the next (for example network \u2192 GKE).",
    why: "Keeping orchestration in one file makes the graph easy to read: APIs first, then network, then cluster, then registries/secrets/ops/addons.",
    provisions: ["module.apis \u2014 enable GCP APIs", "module.network \u2014 VPC / subnet / NAT", "module.gke \u2014 cluster + node pool + workload identity", "module.registry \u2014 Artifact Registry", "module.secrets \u2014 Secret Manager", "module.github_wif \u2014 CI federation", "module.ops \u2014 alerts, logs, backup", "module.addons \u2014 ingress-nginx + CSI Helm charts"],
    examples: [
      {
        title: "main.tf (full)",
        code: `# Root module — wires small focused modules together.
# Keep name_prefix in sync with infra/config.env NAME_PREFIX.

module "apis" {
  source     = "./modules/apis"
  project_id = var.project_id
}

module "network" {
  source     = "./modules/network"
  project_id = var.project_id
  region     = var.region
  name       = local.name

  depends_on = [module.apis]
}

module "gke" {
  source              = "./modules/gke"
  project_id          = var.project_id
  region              = var.region
  name                = local.name
  network             = module.network.network_name
  subnetwork          = module.network.subnet_name
  pods_range_name     = module.network.pods_range_name
  services_range_name = module.network.services_range_name
  labels              = local.labels

  depends_on = [module.network, module.apis]
}

module "registry" {
  source     = "./modules/registry"
  project_id = var.project_id
  region     = var.region
  name       = local.name
  labels     = local.labels

  depends_on = [module.apis]
}

module "secrets" {
  source            = "./modules/secrets"
  project_id        = var.project_id
  name              = local.name
  labels            = local.labels
  app_secrets       = var.app_secrets
  workload_sa_email = module.gke.workload_app_service_account
  node_sa_email     = module.gke.node_service_account_email

  depends_on = [module.apis, module.gke]
}

module "github_wif" {
  source            = "./modules/github_wif"
  project_id        = var.project_id
  name              = local.name
  github_repository = var.github_repository

  depends_on = [module.apis]
}

module "ops" {
  source       = "./modules/ops"
  project_id   = var.project_id
  region       = var.region
  name         = local.name
  labels       = local.labels
  alert_email  = var.alert_email
  cluster_name = module.gke.cluster_name
  cluster_id   = module.gke.cluster_id

  depends_on = [module.apis, module.gke]
}

module "addons" {
  source = "./modules/addons"

  depends_on = [module.gke]
}
`,
      },
    ],
  },
  {
    slug: "variables",
    title: "variables.tf \u2014 inputs",
    blurb: "The few values you configure per environment.",
    path: "infra/terraform/variables.tf",
    what: "Declares root inputs: project, region, naming, GitHub repo for WIF, alert email, and optional app secrets map.",
    why: "Everything else uses module defaults. Operators only edit terraform.tfvars (or CI vars), not module internals.",
    provisions: ["project_id (required)", "region (default us-central1)", "name_prefix (default template)", "github_repository (required)", "alert_email (optional)", "app_secrets (sensitive map)"],
    examples: [
      {
        title: "variables.tf (full)",
        code: `# Variables — only what you usually change

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region (GKE, GAR, buckets)"
  type        = string
  default     = "us-central1"
}

variable "name_prefix" {
  description = "Prefix for resource names. Keep in sync with infra/config.env NAME_PREFIX and Helm global.namePrefix."
  type        = string
  default     = "template"
}

variable "github_repository" {
  description = "GitHub repo allowed to deploy via WIF (org/name)"
  type        = string
}

variable "alert_email" {
  description = "Email for monitoring alerts (empty = no email alerts)"
  type        = string
  default     = ""
}

variable "app_secrets" {
  description = "App secrets stored in Secret Manager (key → value)"
  type        = map(string)
  sensitive   = true
  default = {
    DATABASE_URL   = "postgresql://user:pass@db:5432/app"
    API_SECRET_KEY = "change-me-in-production"
    CORS_ORIGINS   = "*"
  }
}
`,
      },
    ],
  },
  {
    slug: "locals",
    title: "locals.tf \u2014 shared names & labels",
    blurb: "Derived values reused by every module call.",
    path: "infra/terraform/locals.tf",
    what: "Defines local.name from name_prefix and a common labels map applied to GKE, GAR, buckets, etc.",
    why: "Avoid repeating the same strings in main.tf. One place to change naming/label conventions.",
    provisions: ["local.name", "local.labels"],
    examples: [
      {
        title: "locals.tf (full)",
        code: `locals {
  name = var.name_prefix
  labels = {
    managed-by  = "terraform"
    environment = "production"
  }
}
`,
      },
    ],
  },
  {
    slug: "outputs",
    title: "outputs.tf \u2014 values for CI & Helm",
    blurb: "What you copy into GitHub Actions and helm --set.",
    path: "infra/terraform/outputs.tf",
    what: "Exports cluster name/location, Artifact Registry URL, workload SA email, WIF provider/SA, logs bucket, backup plan, and a ready-made get-credentials command.",
    why: "Downstream tools should not dig into module internals \u2014 they consume stable root outputs.",
    provisions: ["gke_cluster_name / gke_cluster_location", "artifact_registry_url", "workload_app_service_account", "wif_provider / wif_service_account", "get_credentials_command"],
    examples: [
      {
        title: "outputs.tf (full)",
        code: `output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "gke_cluster_name" {
  value = module.gke.cluster_name
}

output "gke_cluster_location" {
  value = module.gke.cluster_location
}

output "artifact_registry_url" {
  description = "Base for image pushes: …/frontend and …/backend"
  value       = module.registry.url
}

output "workload_app_service_account" {
  description = "Pass to Helm: global.gcpServiceAccount"
  value       = module.gke.workload_app_service_account
}

output "secret_ids" {
  value = module.secrets.secret_ids
}

output "wif_provider" {
  description = "GitHub Actions var WIF_PROVIDER"
  value       = module.github_wif.wif_provider
}

output "wif_service_account" {
  description = "GitHub Actions var WIF_SERVICE_ACCOUNT"
  value       = module.github_wif.wif_service_account
}

output "logs_bucket" {
  value = module.ops.logs_bucket
}

output "backup_plan" {
  value = module.ops.backup_plan
}

output "get_credentials_command" {
  value = "gcloud container clusters get-credentials \${module.gke.cluster_name} --region \${var.region} --project \${var.project_id}"
}
`,
      },
    ],
  },
  {
    slug: "tfvars",
    title: "terraform.tfvars \u2014 your values",
    blurb: "Copy from the example; never commit real secrets.",
    path: "infra/terraform/terraform.tfvars.example",
    what: "Concrete assignments for the variables. The example file is committed; your real terraform.tfvars is gitignored.",
    why: "Separates code (checked in) from environment-specific secrets and project IDs.",
    provisions: ["project_id, region, name_prefix", "github_repository, alert_email", "optional app_secrets overrides"],
    examples: [
      {
        title: "terraform.tfvars.example (full)",
        code: `# Copy to terraform.tfvars and fill in the blanks.
# These are the only values you need to set.

project_id         = "YOUR_GCP_PROJECT_ID"
region             = "us-central1"
name_prefix        = "template" # keep in sync with infra/config.env NAME_PREFIX
github_repository  = "YOUR_ORG/YOUR_REPO"
alert_email        = "ops@example.com" # or "" to skip email alerts

# Optional — override default secrets before go-live
# app_secrets = {
#   DATABASE_URL   = "postgresql://..."
#   API_SECRET_KEY = "..."
#   CORS_ORIGINS   = "https://example.com"
# }
`,
      },
    ],
    notes: ["Run: cp terraform.tfvars.example terraform.tfvars", "Keep name_prefix equal to infra/config.env NAME_PREFIX and Helm global.namePrefix."],
  },
  {
    slug: "providers",
    title: "providers.tf & versions.tf",
    blurb: "GCP, Kubernetes, and Helm providers + version pins.",
    path: "infra/terraform/providers.tf",
    what: "versions.tf pins Terraform and provider versions. providers.tf configures google/google-beta, then kubernetes/helm using the GKE endpoint from module.gke.",
    why: "Helm addons need a live kube API. Providers are configured after the cluster module so ingress-nginx can install into the new cluster.",
    provisions: ["google + google-beta", "kubernetes + helm (talk to GKE)", "optional GCS backend (commented)"],
    examples: [
      {
        title: "versions.tf (full)",
        code: `terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.14"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.14"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.35"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.17"
    }
  }

  # Production: store state in GCS
  # backend "gcs" {
  #   bucket = "YOUR_TF_STATE_BUCKET"
  #   prefix = "template/infra"
  # }
}
`,
      },
      {
        title: "providers.tf (full)",
        code: `provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

data "google_client_config" "default" {}

provider "kubernetes" {
  host                   = "https://\${module.gke.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(module.gke.ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = "https://\${module.gke.endpoint}"
    token                  = data.google_client_config.default.access_token
    cluster_ca_certificate = base64decode(module.gke.ca_certificate)
  }
}
`,
      },
    ],
  },
];

export const TERRAFORM_MODULE_PAGES: TerraformDocPage[] = [
  {
    slug: "apis",
    title: "apis \u2014 enable GCP APIs",
    blurb: "Turns on the Google APIs this stack needs.",
    path: "infra/terraform/modules/apis",
    what: "Loops over a set of API service names and enables each with google_project_service. Other modules depend on this so resources are not created before the API exists.",
    why: "Fresh GCP projects start with APIs off. Enabling them in Terraform makes apply idempotent and documented.",
    provisions: ["compute, container, artifactregistry", "secretmanager, iam, monitoring, logging", "gkebackup, storage, \u2026"],
    examples: [
      {
        title: "main.tf (full)",
        code: `variable "project_id" {
  type = string
}

variable "services" {
  type = set(string)
  default = [
    "compute.googleapis.com",
    "container.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "gkebackup.googleapis.com",
    "storage.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = var.services

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
`,
      },
      {
        title: "outputs.tf (full)",
        code: `output "enabled" {
  description = "Dependency handle — APIs are ready"
  value       = true
  depends_on  = [google_project_service.apis]
}
`,
      },
    ],
  },
  {
    slug: "network",
    title: "network \u2014 VPC for GKE",
    blurb: "Private VPC, subnet, Cloud NAT, LB health firewall.",
    path: "infra/terraform/modules/network",
    what: "Creates a custom VPC (no auto subnets), a private subnet with secondary ranges for pods/services, a Cloud Router + NAT for egress, and a firewall rule so GCP load balancers can health-check nodes.",
    why: "GKE private nodes need NAT to pull images and call Google APIs. Secondary ranges are required for VPC-native clusters.",
    provisions: ["google_compute_network", "google_compute_subnetwork (+ pods/services ranges)", "google_compute_router + NAT", "firewall for LB health checks (tags: gke-node)"],
    examples: [
      {
        title: "main.tf (full)",
        code: `variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }

resource "google_compute_network" "vpc" {
  name                    = "\${var.name}-vpc"
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "private" {
  name                     = "\${var.name}-subnet"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = "10.10.0.0/20"
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "\${var.name}-pods"
    ip_cidr_range = "10.20.0.0/16"
  }

  secondary_ip_range {
    range_name    = "\${var.name}-services"
    ip_cidr_range = "10.30.0.0/20"
  }
}

resource "google_compute_router" "router" {
  name    = "\${var.name}-router"
  project = var.project_id
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "\${var.name}-nat"
  project                            = var.project_id
  region                             = var.region
  router                             = google_compute_router.router.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

resource "google_compute_firewall" "lb_health" {
  name    = "\${var.name}-lb-health"
  project = var.project_id
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "10254"]
  }

  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  target_tags   = ["gke-node"]
}
`,
      },
      {
        title: "outputs.tf (full)",
        code: `output "network_name" {
  value = google_compute_network.vpc.name
}

output "network_id" {
  value = google_compute_network.vpc.id
}

output "subnet_name" {
  value = google_compute_subnetwork.private.name
}

output "pods_range_name" {
  value = "\${var.name}-pods"
}

output "services_range_name" {
  value = "\${var.name}-services"
}

output "nat_name" {
  value = google_compute_router_nat.nat.name
}
`,
      },
    ],
  },
  {
    slug: "gke",
    title: "gke \u2014 cluster & identity",
    blurb: "Private GKE, node pool, node SA, workload identity SA.",
    path: "infra/terraform/modules/gke",
    what: "Provisions a regional private cluster with Workload Identity, logging/monitoring, Secret Manager add-on, and a managed node pool. Also creates the GCP SA that app pods impersonate via the Kubernetes SA {name}-app.",
    why: "This is the core runtime for Helm workloads. IRSA-equivalent on GCP is Workload Identity \u2014 pods never need JSON keys.",
    provisions: ["Node service account + IAM", "Workload app SA + WI binding to KSA", "google_container_cluster (private nodes)", "google_container_node_pool (autoscaled)"],
    examples: [
      {
        title: "main.tf (full)",
        code: `variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "network" { type = string }
variable "subnetwork" { type = string }
variable "pods_range_name" { type = string }
variable "services_range_name" { type = string }
variable "labels" { type = map(string) }

resource "google_service_account" "nodes" {
  account_id   = "\${var.name}-gke-nodes"
  display_name = "GKE nodes"
  project      = var.project_id
}

resource "google_project_iam_member" "nodes" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/artifactregistry.reader",
    "roles/secretmanager.secretAccessor",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:\${google_service_account.nodes.email}"
}

resource "google_service_account" "workload_app" {
  account_id   = "\${var.name}-workload-app"
  display_name = "App workloads"
  project      = var.project_id
}

resource "google_project_iam_member" "workload_app_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:\${google_service_account.workload_app.email}"
}

resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.workload_app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:\${var.project_id}.svc.id.goog[\${var.name}/\${var.name}-app]"
}

resource "google_container_cluster" "primary" {
  provider = google-beta

  name     = "\${var.name}-gke"
  project  = var.project_id
  location = var.region

  network    = var.network
  subnetwork = var.subnetwork

  remove_default_node_pool = true
  initial_node_count       = 1
  networking_mode          = "VPC_NATIVE"

  release_channel {
    channel = "REGULAR"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "bootstrap"
    }
  }

  workload_identity_config {
    workload_pool = "\${var.project_id}.svc.id.goog"
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }

  # Secret Manager add-on (pods can use Secret Manager via CSI / Workload Identity)
  secret_manager_config {
    enabled = true
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "POD", "DEPLOYMENT", "HPA"]
    managed_prometheus {
      enabled = true
    }
  }

  resource_labels = var.labels

  lifecycle {
    ignore_changes = [node_pool]
  }

  depends_on = [google_project_iam_member.nodes]
}

resource "google_container_node_pool" "primary" {
  name     = "\${var.name}-pool"
  project  = var.project_id
  location = var.region
  cluster  = google_container_cluster.primary.name

  initial_node_count = 1

  autoscaling {
    min_node_count = 1
    max_node_count = 3
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type    = "e2-standard-4"
    disk_size_gb    = 100
    disk_type       = "pd-balanced"
    image_type      = "COS_CONTAINERD"
    service_account = google_service_account.nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
    tags            = ["gke-node"]
    labels          = var.labels

    metadata = {
      disable-legacy-endpoints = "true"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }
}

terraform {
  required_providers {
    google-beta = {
      source = "hashicorp/google-beta"
    }
  }
}
`,
      },
      {
        title: "outputs.tf (full)",
        code: `output "cluster_name" {
  value = google_container_cluster.primary.name
}

output "cluster_location" {
  value = google_container_cluster.primary.location
}

output "cluster_id" {
  value = google_container_cluster.primary.id
}

output "endpoint" {
  value     = google_container_cluster.primary.endpoint
  sensitive = true
}

output "ca_certificate" {
  value     = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive = true
}

output "node_service_account_email" {
  value = google_service_account.nodes.email
}

output "workload_app_service_account" {
  value = google_service_account.workload_app.email
}

output "node_pool_id" {
  value = google_container_node_pool.primary.id
}
`,
      },
    ],
    notes: ["Pass module.gke.workload_app_service_account into Helm as global.gcpServiceAccount.", "Tighten master_authorized_networks in production (defaults open for bootstrap)."],
  },
  {
    slug: "registry",
    title: "registry \u2014 Artifact Registry",
    blurb: "Docker repo for frontend/backend images.",
    path: "infra/terraform/modules/registry",
    what: "Creates a DOCKER-format Artifact Registry repository named {name}-containers. Output url is the base path CI uses to push images.",
    why: "GKE pulls from GAR in-region. Same URL is used by GitHub Actions deploy workflows.",
    provisions: ["google_artifact_registry_repository", "output url"],
    examples: [
      {
        title: "main.tf (full)",
        code: `variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "labels" { type = map(string) }

resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = "\${var.name}-containers"
  description   = "Frontend and backend container images"
  format        = "DOCKER"
  labels        = var.labels
}

output "repository_id" {
  value = google_artifact_registry_repository.containers.repository_id
}

output "url" {
  description = "Base for image pushes: …/frontend and …/backend"
  value       = "\${var.region}-docker.pkg.dev/\${var.project_id}/\${google_artifact_registry_repository.containers.repository_id}"
}
`,
      },
    ],
  },
  {
    slug: "secrets",
    title: "secrets \u2014 Secret Manager",
    blurb: "App secrets + IAM for workload and node SAs.",
    path: "infra/terraform/modules/secrets",
    what: "For each key in app_secrets, creates a Secret Manager secret and version, then grants secretAccessor to the workload SA and node SA (needed for CSI mounts).",
    why: "Keeps DATABASE_URL / API keys out of Git and Helm values in production (CSI or envFrom from secret).",
    provisions: ["google_secret_manager_secret (+ version)", "IAM for workload SA and node SA"],
    examples: [
      {
        title: "main.tf (full)",
        code: `variable "project_id" { type = string }
variable "name" { type = string }
variable "labels" { type = map(string) }
variable "app_secrets" {
  type      = map(string)
  sensitive = true
}
variable "workload_sa_email" { type = string }
variable "node_sa_email" { type = string }

locals {
  # Keys only — values stay sensitive and are not used as instance keys
  secret_keys = nonsensitive(toset(keys(var.app_secrets)))
}

resource "google_secret_manager_secret" "app" {
  for_each = local.secret_keys

  project   = var.project_id
  secret_id = "\${var.name}-\${lower(replace(each.key, "_", "-"))}"
  labels    = var.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "app" {
  for_each = local.secret_keys

  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = var.app_secrets[each.key]
}

resource "google_secret_manager_secret_iam_member" "workload" {
  for_each = local.secret_keys

  project   = var.project_id
  secret_id = google_secret_manager_secret.app[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:\${var.workload_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "nodes" {
  for_each = local.secret_keys

  project   = var.project_id
  secret_id = google_secret_manager_secret.app[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:\${var.node_sa_email}"
}

output "secret_ids" {
  value = { for k in local.secret_keys : k => google_secret_manager_secret.app[k].secret_id }
}
`,
      },
    ],
  },
  {
    slug: "github-wif",
    title: "github_wif \u2014 keyless CI",
    blurb: "Workload Identity Federation for GitHub Actions.",
    path: "infra/terraform/modules/github_wif",
    what: "Creates a WIF pool/provider bound to your GitHub repository, a deployer service account, and roles for GKE + Artifact Registry pushes \u2014 no long-lived JSON keys.",
    why: "GitHub Actions authenticates with OIDC short-lived tokens. Safer than storing GCP keys in repo secrets.",
    provisions: ["Workload Identity Pool + Provider", "CI service account + IAM roles", "outputs: wif_provider, wif_service_account"],
    examples: [
      {
        title: "main.tf (full)",
        code: `variable "project_id" { type = string }
variable "name" { type = string }
variable "github_repository" { type = string }

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == \\"\${var.github_repository}\\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_actions" {
  account_id   = "\${var.name}-ci"
  display_name = "GitHub Actions deployer"
  project      = var.project_id
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/\${google_iam_workload_identity_pool.github.name}/attribute.repository/\${var.github_repository}"
}

resource "google_project_iam_member" "github_actions" {
  for_each = toset([
    "roles/container.developer",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:\${google_service_account.github_actions.email}"
}

output "wif_provider" {
  value = "//iam.googleapis.com/\${google_iam_workload_identity_pool_provider.github.name}"
}

output "wif_service_account" {
  value = google_service_account.github_actions.email
}
`,
      },
    ],
  },
  {
    slug: "ops",
    title: "ops \u2014 alerts, logs, backup",
    blurb: "Email alert on pod restarts, log archive, Backup for GKE.",
    path: "infra/terraform/modules/ops",
    what: "Optional email notification channel + alert policy; GCS bucket + logging sink for GKE logs; daily Backup for GKE plan retaining 14 days.",
    why: "Gives a minimal ops baseline without installing a full observability stack in Terraform (Prometheus/Grafana stay in Helm).",
    provisions: ["Monitoring notification channel + alert (if alert_email set)", "GCS logs bucket + logging sink", "Backup for GKE daily plan"],
    examples: [
      {
        title: "main.tf (full)",
        code: `variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "labels" { type = map(string) }
variable "alert_email" { type = string }
variable "cluster_name" { type = string }
variable "cluster_id" { type = string }

resource "google_monitoring_notification_channel" "email" {
  count = var.alert_email != "" ? 1 : 0

  project      = var.project_id
  display_name = "\${var.name} alerts"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_alert_policy" "pod_restarts" {
  count = var.alert_email != "" ? 1 : 0

  project      = var.project_id
  display_name = "\${var.name} — pod restarts"
  combiner     = "OR"

  conditions {
    display_name = "Containers restarting frequently"
    condition_threshold {
      filter          = "resource.type=\\"k8s_container\\" AND metric.type=\\"kubernetes.io/container/restart_count\\" AND resource.labels.cluster_name=\\"\${var.cluster_name}\\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.pod_name"]
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].id]

  documentation {
    content   = "Check: kubectl get pods -A | grep -v Running"
    mime_type = "text/markdown"
  }
}

resource "google_storage_bucket" "logs" {
  project                     = var.project_id
  name                        = "\${var.project_id}-\${var.name}-logs"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false
  labels                      = var.labels

  lifecycle_rule {
    condition { age = 90 }
    action { type = "Delete" }
  }
}

resource "google_logging_project_sink" "gke_logs" {
  project                = var.project_id
  name                   = "\${var.name}-gke-logs"
  destination            = "storage.googleapis.com/\${google_storage_bucket.logs.name}"
  unique_writer_identity = true

  filter = <<-EOT
    resource.type=("k8s_container" OR "k8s_cluster" OR "k8s_node")
    resource.labels.cluster_name="\${var.cluster_name}"
  EOT
}

resource "google_storage_bucket_iam_member" "logs_writer" {
  bucket = google_storage_bucket.logs.name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.gke_logs.writer_identity
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_iam_member" "backup_agent" {
  project = var.project_id
  role    = "roles/container.admin"
  member  = "serviceAccount:service-\${data.google_project.current.number}@gcp-sa-gkebackup.iam.gserviceaccount.com"
}

resource "google_gke_backup_backup_plan" "daily" {
  project  = var.project_id
  name     = "\${var.name}-daily"
  location = var.region
  cluster  = var.cluster_id

  retention_policy {
    backup_retain_days      = 14
    backup_delete_lock_days = 1
  }

  backup_schedule {
    cron_schedule = "0 2 * * *"
  }

  backup_config {
    include_volume_data = true
    include_secrets     = true
    all_namespaces      = true
  }

  labels = var.labels

  depends_on = [
    google_project_iam_member.backup_agent,
  ]
}

output "logs_bucket" {
  value = google_storage_bucket.logs.name
}

output "backup_plan" {
  value = google_gke_backup_backup_plan.daily.name
}
`,
      },
    ],
  },
  {
    slug: "addons",
    title: "addons \u2014 ingress & CSI",
    blurb: "Helm: Secret CSI provider + ingress-nginx.",
    path: "infra/terraform/modules/addons",
    what: "After GKE is ready, installs the GCP Secrets Store CSI provider chart and ingress-nginx (external LoadBalancer) into the cluster via the Helm/Kubernetes providers.",
    why: "Edge routing (/ and /api) and secret mounts are cluster software \u2014 installed once with the cluster, then your app chart rides on top.",
    provisions: ["helm_release csi-secrets-store-provider-gcp", "namespace ingress-nginx", "helm_release ingress-nginx (LB service)"],
    examples: [
      {
        title: "main.tf (full)",
        code: `# Cluster add-ons: Secret CSI provider + ingress-nginx

terraform {
  required_providers {
    kubernetes = {
      source = "hashicorp/kubernetes"
    }
    helm = {
      source = "hashicorp/helm"
    }
  }
}

resource "helm_release" "csi_provider" {
  name       = "csi-secrets-store-provider-gcp"
  repository = "oci://us-docker.pkg.dev/google-samples/charts"
  chart      = "csi-secrets-store-provider-gcp"
  version    = "1.6.0"
  namespace  = "kube-system"

  wait    = true
  timeout = 300
}

resource "kubernetes_namespace" "ingress_nginx" {
  metadata {
    name = "ingress-nginx"
  }
}

resource "helm_release" "ingress_nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = "4.12.0"
  namespace  = kubernetes_namespace.ingress_nginx.metadata[0].name

  wait    = true
  timeout = 600

  values = [
    yamlencode({
      controller = {
        replicaCount = 2
        ingressClassResource = {
          name    = "nginx"
          enabled = true
          default = true
        }
        ingressClass = "nginx"
        service = {
          type = "LoadBalancer"
          annotations = {
            "cloud.google.com/load-balancer-type" = "External"
          }
        }
        metrics = {
          enabled = true
        }
      }
    })
  ]

  depends_on = [
    helm_release.csi_provider,
    kubernetes_namespace.ingress_nginx,
  ]
}
`,
      },
    ],
  },
];

export function getTerraformPage(slug: string): TerraformDocPage | undefined {
  return (
    TERRAFORM_ROOT_PAGES.find((p) => p.slug === slug) ??
    TERRAFORM_MODULE_PAGES.find((p) => p.slug === slug)
  );
}

export function allTerraformSlugs(): string[] {
  return [...TERRAFORM_ROOT_PAGES, ...TERRAFORM_MODULE_PAGES].map((p) => p.slug);
}
