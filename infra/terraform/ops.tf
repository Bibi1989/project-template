# Ops — monitoring, logging, backup (kept small on purpose)
#
# Monitoring  → one email alert when pods restart too often
# Logging     → GKE already sends logs to Cloud Logging (see gke.tf);
#               this sink also archives them to a GCS bucket
# Backup      → Backup for GKE runs daily and keeps 14 days

# --- Monitoring --------------------------------------------------------------

resource "google_monitoring_notification_channel" "email" {
  count = var.alert_email != "" ? 1 : 0

  project      = var.project_id
  display_name = "${local.name} alerts"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_alert_policy" "pod_restarts" {
  count = var.alert_email != "" ? 1 : 0

  project      = var.project_id
  display_name = "${local.name} — pod restarts"
  combiner     = "OR"

  conditions {
    display_name = "Containers restarting frequently"
    condition_threshold {
      filter          = "resource.type=\"k8s_container\" AND metric.type=\"kubernetes.io/container/restart_count\" AND resource.labels.cluster_name=\"${google_container_cluster.primary.name}\""
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

  depends_on = [google_project_service.apis]
}

# --- Logging archive ---------------------------------------------------------

resource "google_storage_bucket" "logs" {
  project                     = var.project_id
  name                        = "${var.project_id}-${local.name}-logs"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false
  labels                      = local.labels

  lifecycle_rule {
    condition { age = 90 }
    action { type = "Delete" }
  }

  depends_on = [google_project_service.apis]
}

resource "google_logging_project_sink" "gke_logs" {
  project                = var.project_id
  name                   = "${local.name}-gke-logs"
  destination            = "storage.googleapis.com/${google_storage_bucket.logs.name}"
  unique_writer_identity = true

  filter = <<-EOT
    resource.type=("k8s_container" OR "k8s_cluster" OR "k8s_node")
    resource.labels.cluster_name="${google_container_cluster.primary.name}"
  EOT
}

resource "google_storage_bucket_iam_member" "logs_writer" {
  bucket = google_storage_bucket.logs.name
  role   = "roles/storage.objectCreator"
  member = google_logging_project_sink.gke_logs.writer_identity
}

# --- Backup for GKE ----------------------------------------------------------

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_iam_member" "backup_agent" {
  project = var.project_id
  role    = "roles/container.admin"
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-gkebackup.iam.gserviceaccount.com"

  depends_on = [google_project_service.apis]
}

resource "google_gke_backup_backup_plan" "daily" {
  project  = var.project_id
  name     = "${local.name}-daily"
  location = var.region
  cluster  = google_container_cluster.primary.id

  retention_policy {
    backup_retain_days      = 14
    backup_delete_lock_days = 1
  }

  backup_schedule {
    cron_schedule = "0 2 * * *" # 02:00 UTC daily
  }

  backup_config {
    include_volume_data = true
    include_secrets     = true
    all_namespaces      = true
  }

  labels = local.labels

  depends_on = [
    google_container_node_pool.primary,
    google_project_iam_member.backup_agent,
  ]
}
