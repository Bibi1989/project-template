# Secrets — Secret Manager values mounted into pods via CSI

resource "google_secret_manager_secret" "app" {
  for_each = var.app_secrets

  project   = var.project_id
  secret_id = "${local.name}-${lower(replace(each.key, "_", "-"))}"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "app" {
  for_each = var.app_secrets

  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value
}

resource "google_secret_manager_secret_iam_member" "workload" {
  for_each = google_secret_manager_secret.app

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.workload_app.email}"
}

resource "google_secret_manager_secret_iam_member" "nodes" {
  for_each = google_secret_manager_secret.app

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gke_nodes.email}"
}
