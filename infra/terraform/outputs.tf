output "project_id" {
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
  value = "gcloud container clusters get-credentials ${module.gke.cluster_name} --region ${var.region} --project ${var.project_id}"
}
