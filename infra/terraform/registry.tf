# Registry — Docker image storage (GAR)

resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = "${local.name}-containers"
  description   = "Frontend and backend container images"
  format        = "DOCKER"
  labels        = local.labels

  depends_on = [google_project_service.apis]
}
