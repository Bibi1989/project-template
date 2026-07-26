variable "project_id" { type = string }
variable "region" { type = string }
variable "name" { type = string }
variable "network" { type = string }
variable "subnetwork" { type = string }
variable "pods_range_name" { type = string }
variable "services_range_name" { type = string }
variable "labels" { type = map(string) }

resource "google_service_account" "nodes" {
  account_id   = "${var.name}-gke-nodes"
  display_name = "GKE nodes"
  project      = var.project_id
}

resource "google_project_iam_member" "nodes" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/artifactregistry.reader",
    "roles/secretmanager.secretAccessor",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.nodes.email}"
}

resource "google_service_account" "workload_app" {
  account_id   = "${var.name}-workload-app"
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
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.name}/${var.name}-app]"
}

resource "google_container_cluster" "primary" {
  provider = google-beta

  name     = "${var.name}-gke"
  project  = var.project_id
  location = var.region

  network    = var.network
  subnetwork = var.subnetwork

  remove_default_node_pool = true
  initial_node_count       = 1
  networking_mode          = "VPC_NATIVE"

  release_channel {
    channel = "REGULAR"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

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
  }

  # Secret Manager add-on (pods can use Secret Manager via CSI / Workload Identity)
  secret_manager_config {
    enabled = true
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

  resource_labels = var.labels

  lifecycle {
    ignore_changes = [node_pool]
  }

  depends_on = [google_project_iam_member.nodes]
}

resource "google_container_node_pool" "primary" {
  name     = "${var.name}-pool"
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
    service_account = google_service_account.nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
    tags            = ["gke-node"]
    labels          = var.labels

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

terraform {
  required_providers {
    google-beta = {
      source = "hashicorp/google-beta"
    }
  }
}
