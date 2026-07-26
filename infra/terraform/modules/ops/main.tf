variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "labels" { type = map(string) }
variable "alert_email" { type = string }
variable "cluster_name" { type = string }
variable "cluster_id" { type = string }

resource "google_monitoring_notification_channel" "email" {
  count = var.alert_email != "" ? 1 : 0

  project      = var.project_id
  display_name = "${var.name} alerts"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_alert_policy" "pod_restarts" {
  count = var.alert_email != "" ? 1 : 0

  project      = var.project_id
  display_name = "${var.name} — pod restarts"
  combiner     = "OR"

  conditions {
    display_name = "Containers restarting frequently"
    condition_threshold {
      filter          = "resource.type=\"k8s_container\" AND metric.type=\"kubernetes.io/container/restart_count\" AND resource.labels.cluster_name=\"${var.cluster_name}\""
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
  name                        = "${var.project_id}-${var.name}-logs"
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
  name                   = "${var.name}-gke-logs"
  destination            = "storage.googleapis.com/${google_storage_bucket.logs.name}"
  unique_writer_identity = true

  filter = <<-EOT
    resource.type=("k8s_container" OR "k8s_cluster" OR "k8s_node")
    resource.labels.cluster_name="${var.cluster_name}"
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
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-gkebackup.iam.gserviceaccount.com"
}

resource "google_gke_backup_backup_plan" "daily" {
  project  = var.project_id
  name     = "${var.name}-daily"
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
