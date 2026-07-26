variable "project_id" { type = string }
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
  secret_id = "${var.name}-${lower(replace(each.key, "_", "-"))}"
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
  member    = "serviceAccount:${var.workload_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "nodes" {
  for_each = local.secret_keys

  project   = var.project_id
  secret_id = google_secret_manager_secret.app[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.node_sa_email}"
}

output "secret_ids" {
  value = { for k in local.secret_keys : k => google_secret_manager_secret.app[k].secret_id }
}
