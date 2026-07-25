# Outputs — values you paste into GitHub Actions / Helm

output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "gke_cluster_name" {
  value = google_container_cluster.primary.name
}

output "gke_cluster_location" {
  value = google_container_cluster.primary.location
}

output "artifact_registry_url" {
  description = "Base for image pushes: …/frontend and …/backend"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"
}

output "workload_app_service_account" {
  description = "Pass to Helm: global.gcpServiceAccount"
  value       = google_service_account.workload_app.email
}

output "secret_ids" {
  value = { for k, s in google_secret_manager_secret.app : k => s.secret_id }
}

output "wif_provider" {
  description = "GitHub Actions var WIF_PROVIDER"
  value       = "//iam.googleapis.com/${google_iam_workload_identity_pool_provider.github.name}"
}

output "wif_service_account" {
  description = "GitHub Actions var WIF_SERVICE_ACCOUNT"
  value       = google_service_account.github_actions.email
}

output "logs_bucket" {
  value = google_storage_bucket.logs.name
}

output "backup_plan" {
  value = google_gke_backup_backup_plan.daily.name
}

output "get_credentials_command" {
  value = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --region ${var.region} --project ${var.project_id}"
}
