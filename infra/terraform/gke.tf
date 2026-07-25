# GKE — private regional cluster + node pool
#
# Built-in: Workload Identity, Secrets Store CSI, Managed Prometheus,
#           Cloud Logging (system + workloads), Cloud Monitoring

resource "google_service_account" "gke_nodes" {
  account_id   = "${local.name}-gke-nodes"
  display_name = "GKE nodes"
  project      = var.project_id
}

resource "google_project_iam_member" "gke_nodes" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/artifactregistry.reader",
    "roles/secretmanager.secretAccessor",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# Used by app pods (via Workload Identity) to read Secret Manager
resource "google_service_account" "workload_app" {
  account_id   = "${local.name}-workload-app"
  display_name = "App workloads"
  project      = var.project_id
}

resource "google_project_iam_member" "workload_app_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.workload_app.email}"
}

resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.workload_app.name
  role               = "roles/iam.workloadIdentityUser"
  # KSA name matches Helm: {name_prefix}-app in namespace {name_prefix}
  member = "serviceAccount:${var.project_id}.svc.id.goog[${local.name}/${local.name}-app]"
}

resource "google_container_cluster" "primary" {
  provider = google-beta

  name     = "${local.name}-gke"
  project  = var.project_id
  location = var.region

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.private.name

  remove_default_node_pool = true
  initial_node_count       = 1
  networking_mode          = "VPC_NATIVE"

  release_channel {
    channel = "REGULAR"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "${local.name}-pods"
    services_secondary_range_name = "${local.name}-services"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Tighten this CIDR in production
  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "0.0.0.0/0"
      display_name = "bootstrap"
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
    secrets_store_csi_driver_config {
      enabled = true
    }
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "POD", "DEPLOYMENT", "HPA"]
    managed_prometheus {
      enabled = true
    }
  }

  resource_labels = local.labels

  lifecycle {
    ignore_changes = [node_pool]
  }

  depends_on = [
    google_project_service.apis,
    google_compute_router_nat.nat,
    google_project_iam_member.gke_nodes,
  ]
}

resource "google_container_node_pool" "primary" {
  name     = "${local.name}-pool"
  project  = var.project_id
  location = var.region
  cluster  = google_container_cluster.primary.name

  initial_node_count = 1

  autoscaling {
    min_node_count = 1
    max_node_count = 3
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type    = "e2-standard-4"
    disk_size_gb    = 100
    disk_type       = "pd-balanced"
    image_type      = "COS_CONTAINERD"
    service_account = google_service_account.gke_nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
    tags            = ["gke-node"]
    labels          = local.labels

    metadata = {
      disable-legacy-endpoints = "true"
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }
}
