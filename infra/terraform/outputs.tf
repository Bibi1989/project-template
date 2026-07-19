# =============================================================================
# Terraform — outputs
# =============================================================================

output "project_id" {
  description = "GCP project ID."
  value       = var.project_id
}

output "region" {
  description = "Primary region."
  value       = var.region
}

output "vpc_name" {
  description = "Custom VPC network name."
  value       = google_compute_network.vpc.name
}

output "vpc_id" {
  description = "Custom VPC network self-link / ID."
  value       = google_compute_network.vpc.id
}

output "subnet_name" {
  description = "Private subnet name used by GKE nodes."
  value       = google_compute_subnetwork.private.name
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository ID."
  value       = google_artifact_registry_repository.containers.repository_id
}

output "artifact_registry_url" {
  description = "Base Docker registry URL for pushes (region-docker.pkg.dev/project/repo)."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"
}

output "gke_cluster_name" {
  description = "GKE cluster name."
  value       = google_container_cluster.primary.name
}

output "gke_cluster_endpoint" {
  description = "GKE API endpoint."
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "gke_cluster_location" {
  description = "GKE cluster location (region)."
  value       = google_container_cluster.primary.location
}

output "gke_node_service_account" {
  description = "GKE node service account email (has roles/secretmanager.secretAccessor)."
  value       = google_service_account.gke_nodes.email
}

output "workload_app_service_account" {
  description = "GCP SA for Workload Identity app pods (Secret Manager accessor)."
  value       = google_service_account.workload_app.email
}

output "secret_ids" {
  description = "Map of logical env key → Secret Manager secret_id."
  value = {
    for k, s in google_secret_manager_secret.app : k => s.secret_id
  }
}

output "secret_resource_names" {
  description = "Full resource names for SecretProviderClass (projects/.../secrets/.../versions/latest)."
  value = {
    for k, s in google_secret_manager_secret.app :
    k => "projects/${var.project_id}/secrets/${s.secret_id}/versions/latest"
  }
}

output "ingress_nginx_namespace" {
  description = "Namespace where ingress-nginx is installed."
  value       = helm_release.ingress_nginx.namespace
}

output "ingress_nginx_release" {
  description = "Helm release name for ingress-nginx."
  value       = helm_release.ingress_nginx.name
}

output "get_credentials_command" {
  description = "Convenience command to fetch kubeconfig."
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --region ${var.region} --project ${var.project_id}"
}

output "helm_app_install_hint" {
  description = "Example Helm install for the application chart."
  value       = <<-EOT
    helm upgrade --install ${var.name_prefix}-app ../helm/app \
      --namespace ${var.name_prefix} --create-namespace \
      --set global.projectId=${var.project_id} \
      --set global.gcpServiceAccount=${google_service_account.workload_app.email} \
      --set frontend.image.repository=${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}/frontend \
      --set backend.image.repository=${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}/backend
  EOT
}
