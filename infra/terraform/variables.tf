# Variables — only what you usually change
#
# Everything else uses sensible defaults inside the .tf files.

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region (GKE, GAR, buckets)"
  type        = string
  default     = "us-central1"
}

variable "name_prefix" {
  description = "Prefix for resource names. Keep in sync with infra/config.env NAME_PREFIX and Helm global.namePrefix."
  type        = string
  default     = "template"
}

variable "github_repository" {
  description = "GitHub repo allowed to deploy via WIF (org/name)"
  type        = string
}

variable "alert_email" {
  description = "Email for monitoring alerts (empty = no email alerts)"
  type        = string
  default     = ""
}

variable "app_secrets" {
  description = "App secrets stored in Secret Manager (key → value)"
  type        = map(string)
  sensitive   = true
  default = {
    DATABASE_URL   = "postgresql://user:pass@db:5432/app"
    API_SECRET_KEY = "change-me-in-production"
    CORS_ORIGINS   = "*"
  }
}

# Shared names / labels used by every resource file
locals {
  name   = var.name_prefix
  labels = {
    managed-by  = "terraform"
    environment = "production"
  }
}
