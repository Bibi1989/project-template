# =============================================================================
# Optional — GitHub Actions Workload Identity Federation
# Enable with: enable_github_wif = true
# =============================================================================

variable "enable_github_wif" {
  description = "Provision Workload Identity Federation for GitHub Actions."
  type        = bool
  default     = true
}

variable "github_repository" {
  description = "GitHub repo in org/name form allowed to authenticate via WIF (e.g. acme/turnkey)."
  type        = string
  default     = "YOUR_ORG/YOUR_REPO"
}

variable "github_wif_pool_id" {
  description = "Workload Identity Pool ID."
  type        = string
  default     = "github-actions-pool"
}

variable "github_wif_provider_id" {
  description = "Workload Identity Pool Provider ID."
  type        = string
  default     = "github-actions-provider"
}

resource "google_iam_workload_identity_pool" "github" {
  count = var.enable_github_wif ? 1 : 0

  project                   = var.project_id
  workload_identity_pool_id = var.github_wif_pool_id
  display_name              = "GitHub Actions"
  description               = "OIDC federation for GitHub Actions CI/CD"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count = var.enable_github_wif ? 1 : 0

  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = var.github_wif_provider_id
  display_name                       = "GitHub OIDC"
  description                        = "GitHub Actions OIDC provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_actions" {
  count = var.enable_github_wif ? 1 : 0

  account_id   = "${local.name}-github-actions"
  display_name = "GitHub Actions deployer (${local.name})"
  project      = var.project_id
}

resource "google_service_account_iam_member" "github_actions_wif" {
  count = var.enable_github_wif ? 1 : 0

  service_account_id = google_service_account.github_actions[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repository}"
}

resource "google_project_iam_member" "github_actions_roles" {
  for_each = var.enable_github_wif ? toset([
    "roles/container.developer",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
  ]) : toset([])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_actions[0].email}"
}

output "wif_provider_resource_name" {
  description = "Full WIF provider resource name for GitHub Actions (vars.WIF_PROVIDER)."
  value = var.enable_github_wif ? "//iam.googleapis.com/${google_iam_workload_identity_pool_provider.github[0].name}" : null
}

output "wif_service_account_email" {
  description = "GitHub Actions service account email (vars.WIF_SERVICE_ACCOUNT)."
  value       = var.enable_github_wif ? google_service_account.github_actions[0].email : null
}
