# =============================================================================
# Terraform — core orchestration & shared locals
# =============================================================================

locals {
  name = var.name_prefix

  common_labels = merge(var.labels, {
    environment = var.environment
    project     = var.project_id
  })

  network_name    = "${local.name}-vpc"
  subnet_name     = "${local.name}-subnet-private"
  pods_range_name = "${local.name}-pods"
  svcs_range_name = "${local.name}-services"
  cluster_name    = "${local.name}-gke"
  router_name     = "${local.name}-router"
  nat_name        = "${local.name}-nat"

  # GKE nodes / workload identity pool convention
  wi_pool = "${var.project_id}.svc.id.goog"
}

# -----------------------------------------------------------------------------
# Enable required GCP APIs
# -----------------------------------------------------------------------------

resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "servicenetworking.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# VPC + private subnet (isolated node network)
# -----------------------------------------------------------------------------

resource "google_compute_network" "vpc" {
  name                    = local.network_name
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
  description             = "Turnkey custom VPC for GKE private workloads"

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "private" {
  name                     = local.subnet_name
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.vpc_cidr
  private_ip_google_access = true
  description              = "Private subnet for GKE nodes"

  secondary_ip_range {
    range_name    = local.pods_range_name
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = local.svcs_range_name
    ip_cidr_range = var.services_cidr
  }

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_router" "router" {
  name    = local.router_name
  project = var.project_id
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = local.nat_name
  project                            = var.project_id
  region                             = var.region
  router                             = google_compute_router.router.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Allow health checks / LB → nodes for Ingress NGINX
resource "google_compute_firewall" "allow_lb_health_checks" {
  name    = "${local.name}-allow-lb-health"
  project = var.project_id
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "10254"]
  }

  source_ranges = [
    "130.211.0.0/22",
    "35.191.0.0/16",
  ]

  target_tags = ["gke-node"]
  description = "GCP load balancer health checks to ingress-nginx"
}

# -----------------------------------------------------------------------------
# Artifact Registry (Docker)
# -----------------------------------------------------------------------------

resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repository_id
  description   = "Docker images for turnkey frontend/backend services"
  format        = "DOCKER"
  labels        = local.common_labels

  docker_config {
    immutable_tags = false
  }

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      keep_count = 20
    }
  }

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# IAM — GKE node service account
# -----------------------------------------------------------------------------

resource "google_service_account" "gke_nodes" {
  account_id   = "${local.name}-gke-nodes"
  display_name = "GKE node service account (${local.name})"
  project      = var.project_id
}

resource "google_project_iam_member" "gke_nodes_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/artifactregistry.reader",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# Workload Identity KSAs for app pods (CSI Secret Manager access)
resource "google_service_account" "workload_app" {
  account_id   = "${local.name}-workload-app"
  display_name = "Workload Identity SA for app pods (${local.name})"
  project      = var.project_id
}

resource "google_project_iam_member" "workload_app_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.workload_app.email}"
}

# Also grant the GKE node SA secret accessor as requested for cluster-level access
resource "google_project_iam_member" "gke_nodes_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# -----------------------------------------------------------------------------
# GKE — production-oriented private cluster with Secrets Store CSI enabled
# -----------------------------------------------------------------------------

resource "google_container_cluster" "primary" {
  provider = google-beta

  name     = local.cluster_name
  project  = var.project_id
  location = var.region

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.private.name

  # Remove default node pool; manage via dedicated node pool resource
  remove_default_node_pool = true
  initial_node_count       = 1

  release_channel {
    channel = var.gke_release_channel
  }

  networking_mode = "VPC_NATIVE"

  ip_allocation_policy {
    cluster_secondary_range_name  = local.pods_range_name
    services_secondary_range_name = local.svcs_range_name
  }

  private_cluster_config {
    enable_private_nodes    = var.gke_enable_private_nodes
    enable_private_endpoint = var.gke_enable_private_endpoint
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.gke_master_authorized_cidrs
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  workload_identity_config {
    workload_pool = local.wi_pool
  }

  # Explicitly enable Secrets Store CSI Driver (Secret Manager integration)
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    network_policy_config {
      disabled = false
    }
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
    gcp_filestore_csi_driver_config {
      enabled = false
    }
    dns_cache_config {
      enabled = true
    }
    gcs_fuse_csi_driver_config {
      enabled = false
    }
    # REQUIRED: Secrets Store CSI Driver for Secret Manager mounts
    secrets_store_csi_driver_config {
      enabled = true
    }
  }

  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  # DISABLED for turnkey bootstrap; set PROJECT_SINGLETON_POLICY_ENFORCE in hardened envs.
  binary_authorization {
    evaluation_mode = "DISABLED"
  }

  lifecycle {
    ignore_changes = [node_pool]
  }

  logging_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "WORKLOADS",
    ]
  }

  monitoring_config {
    enable_components = [
      "SYSTEM_COMPONENTS",
      "STORAGE",
      "HPA",
      "POD",
      "DEPLOYMENT",
    ]
    managed_prometheus {
      enabled = true
    }
  }

  maintenance_policy {
    daily_maintenance_window {
      start_time = "05:00"
    }
  }

  resource_labels = local.common_labels

  depends_on = [
    google_project_service.apis,
    google_compute_subnetwork.private,
    google_compute_router_nat.nat,
    google_project_iam_member.gke_nodes_roles,
  ]
}

resource "google_container_node_pool" "primary_nodes" {
  provider = google-beta

  name     = "${local.name}-pool"
  project  = var.project_id
  location = var.region
  cluster  = google_container_cluster.primary.name

  initial_node_count = var.gke_initial_node_count

  autoscaling {
    min_node_count = var.gke_min_node_count
    max_node_count = var.gke_max_node_count
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  node_config {
    machine_type    = var.gke_node_machine_type
    disk_size_gb    = var.gke_node_disk_size_gb
    disk_type       = "pd-balanced"
    image_type      = "COS_CONTAINERD"
    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    tags = ["gke-node", "${local.name}-node"]

    labels = local.common_labels

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

  depends_on = [google_container_cluster.primary]
}

# -----------------------------------------------------------------------------
# Secret Manager — application environment secrets + IAM
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "app" {
  for_each = var.app_secrets

  project   = var.project_id
  secret_id = "${local.name}-${lower(replace(each.key, "_", "-"))}"
  labels    = local.common_labels

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

# Grant Secret Accessor on each secret to the GKE node SA and workload SA
resource "google_secret_manager_secret_iam_member" "gke_nodes_accessor" {
  for_each = google_secret_manager_secret.app

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_secret_manager_secret_iam_member" "workload_accessor" {
  for_each = google_secret_manager_secret.app

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.workload_app.email}"
}

# -----------------------------------------------------------------------------
# GCP Secret Manager CSI Provider plugin
# (GKE addon enables the CSI driver; this installs the GCP provider daemonset)
# -----------------------------------------------------------------------------

resource "helm_release" "csi_secrets_store_provider_gcp" {
  name       = "csi-secrets-store-provider-gcp"
  repository = "oci://us-docker.pkg.dev/google-samples/charts"
  chart      = "csi-secrets-store-provider-gcp"
  version    = "1.6.0"
  namespace  = "kube-system"

  atomic          = true
  cleanup_on_fail = true
  wait            = true
  timeout         = 300

  depends_on = [
    google_container_cluster.primary,
    google_container_node_pool.primary_nodes,
  ]
}

# -----------------------------------------------------------------------------
# Edge reverse proxy — ingress-nginx via Helm (creates GCP external LB)
# -----------------------------------------------------------------------------

resource "kubernetes_namespace" "ingress_nginx" {
  metadata {
    name = var.ingress_nginx_namespace
    labels = {
      "app.kubernetes.io/name" = "ingress-nginx"
    }
  }

  depends_on = [
    google_container_cluster.primary,
    google_container_node_pool.primary_nodes,
  ]
}

resource "helm_release" "ingress_nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = var.ingress_nginx_chart_version
  namespace  = kubernetes_namespace.ingress_nginx.metadata[0].name

  atomic          = true
  cleanup_on_fail = true
  wait            = true
  timeout         = 600

  values = [
    yamlencode({
      controller = {
        replicaCount = var.ingress_nginx_replica_count
        ingressClassResource = {
          name            = "nginx"
          enabled         = true
          default         = true
          controllerValue = "k8s.io/ingress-nginx"
        }
        ingressClass = "nginx"
        service = {
          type = var.enable_http_load_balancer ? "LoadBalancer" : "ClusterIP"
          annotations = var.enable_http_load_balancer ? {
            "cloud.google.com/load-balancer-type" = "External"
          } : {}
        }
        metrics = {
          enabled = true
        }
        config = {
          "use-forwarded-headers" = "true"
          "compute-full-forwarded-for" = "true"
          "use-proxy-protocol" = "false"
        }
        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "512Mi"
          }
        }
        admissionWebhooks = {
          enabled = true
        }
      }
    })
  ]

  depends_on = [
    kubernetes_namespace.ingress_nginx,
    google_container_node_pool.primary_nodes,
    helm_release.csi_secrets_store_provider_gcp,
  ]
}

# Bind Kubernetes ServiceAccount (app namespace) → GCP Workload Identity SA
# Actual KSA is created by Helm; this IAM binding prepares the GCP side.
resource "google_service_account_iam_member" "workload_identity_binding" {
  service_account_id = google_service_account.workload_app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.name_prefix}/${var.name_prefix}-app]"
}
