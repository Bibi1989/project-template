# =============================================================================
# Terraform — input variables (all externally configurable)
# =============================================================================

variable "project_id" {
  description = "GCP project ID that owns all turnkey resources."
  type        = string
}

variable "region" {
  description = "Primary GCP region for regional resources (GAR, GKE, subnets)."
  type        = string
  default     = "us-central1"
}

variable "name_prefix" {
  description = "Short prefix applied to resource names (e.g. turnkey)."
  type        = string
  default     = "turnkey"
}

variable "environment" {
  description = "Environment label (production, staging, etc.)."
  type        = string
  default     = "production"
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "Primary CIDR for the custom VPC subnet (private nodes)."
  type        = string
  default     = "10.10.0.0/20"
}

variable "pods_cidr" {
  description = "Secondary CIDR range for GKE Pods."
  type        = string
  default     = "10.20.0.0/16"
}

variable "services_cidr" {
  description = "Secondary CIDR range for GKE Services."
  type        = string
  default     = "10.30.0.0/20"
}

variable "master_ipv4_cidr_block" {
  description = "Private master endpoint CIDR (/28)."
  type        = string
  default     = "172.16.0.0/28"
}

# -----------------------------------------------------------------------------
# GKE
# -----------------------------------------------------------------------------

variable "gke_release_channel" {
  description = "GKE release channel (RAPID, REGULAR, STABLE)."
  type        = string
  default     = "REGULAR"
}

variable "gke_node_machine_type" {
  description = "Machine type for the default node pool."
  type        = string
  default     = "e2-standard-4"
}

variable "gke_node_disk_size_gb" {
  description = "Boot disk size (GB) for GKE nodes."
  type        = number
  default     = 100
}

variable "gke_min_node_count" {
  description = "Minimum nodes per zone for autoscaling."
  type        = number
  default     = 1
}

variable "gke_max_node_count" {
  description = "Maximum nodes per zone for autoscaling."
  type        = number
  default     = 3
}

variable "gke_initial_node_count" {
  description = "Initial node count per zone."
  type        = number
  default     = 1
}

variable "gke_enable_private_nodes" {
  description = "Place GKE nodes on private IPs only."
  type        = bool
  default     = true
}

variable "gke_enable_private_endpoint" {
  description = "If true, master API is private-only (requires bastion/VPN)."
  type        = bool
  default     = false
}

variable "gke_master_authorized_cidrs" {
  description = "CIDR blocks allowed to reach the GKE control plane."
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "open-for-bootstrap"
    }
  ]
}

# -----------------------------------------------------------------------------
# Artifact Registry
# -----------------------------------------------------------------------------

variable "artifact_registry_repository_id" {
  description = "Artifact Registry repository ID for Docker images."
  type        = string
  default     = "turnkey-containers"
}

# -----------------------------------------------------------------------------
# Secrets (application environment)
# -----------------------------------------------------------------------------

variable "app_secrets" {
  description = "Map of Secret Manager secret IDs → secret payload strings."
  type        = map(string)
  sensitive   = true
  default = {
    DATABASE_URL  = "postgresql://user:pass@db:5432/app"
    API_SECRET_KEY = "change-me-in-production"
    CORS_ORIGINS   = "*"
  }
}

# -----------------------------------------------------------------------------
# Ingress NGINX (Helm)
# -----------------------------------------------------------------------------

variable "ingress_nginx_namespace" {
  description = "Namespace for the ingress-nginx controller."
  type        = string
  default     = "ingress-nginx"
}

variable "ingress_nginx_chart_version" {
  description = "Official ingress-nginx Helm chart version."
  type        = string
  default     = "4.12.0"
}

variable "ingress_nginx_replica_count" {
  description = "Number of ingress-nginx controller replicas."
  type        = number
  default     = 2
}

variable "enable_http_load_balancer" {
  description = "Expose ingress-nginx via an external GCP Network Load Balancer."
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Labels
# -----------------------------------------------------------------------------

variable "labels" {
  description = "Common labels applied to GCP resources."
  type        = map(string)
  default = {
    managed-by  = "terraform"
    architecture = "turnkey-gke"
  }
}
