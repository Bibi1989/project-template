locals {
  name = var.name_prefix
  labels = {
    managed-by  = "terraform"
    environment = "production"
  }
}
