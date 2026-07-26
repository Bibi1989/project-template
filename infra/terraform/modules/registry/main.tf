variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "labels" { type = map(string) }

resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = "${var.name}-containers"
  description   = "Frontend and backend container images"
  format        = "DOCKER"
  labels        = var.labels
}

output "repository_id" {
  value = google_artifact_registry_repository.containers.repository_id
}

output "url" {
  description = "Base for image pushes: …/frontend and …/backend"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"
}
