# Root module — wires small focused modules together.
# Keep name_prefix in sync with infra/config.env NAME_PREFIX.

module "apis" {
  source     = "./modules/apis"
  project_id = var.project_id
}

module "network" {
  source     = "./modules/network"
  project_id = var.project_id
  region     = var.region
  name       = local.name

  depends_on = [module.apis]
}

module "gke" {
  source              = "./modules/gke"
  project_id          = var.project_id
  region              = var.region
  name                = local.name
  network             = module.network.network_name
  subnetwork          = module.network.subnet_name
  pods_range_name     = module.network.pods_range_name
  services_range_name = module.network.services_range_name
  labels              = local.labels

  depends_on = [module.network, module.apis]
}

module "registry" {
  source     = "./modules/registry"
  project_id = var.project_id
  region     = var.region
  name       = local.name
  labels     = local.labels

  depends_on = [module.apis]
}

module "secrets" {
  source            = "./modules/secrets"
  project_id        = var.project_id
  name              = local.name
  labels            = local.labels
  app_secrets       = var.app_secrets
  workload_sa_email = module.gke.workload_app_service_account
  node_sa_email     = module.gke.node_service_account_email

  depends_on = [module.apis, module.gke]
}

module "github_wif" {
  source            = "./modules/github_wif"
  project_id        = var.project_id
  name              = local.name
  github_repository = var.github_repository

  depends_on = [module.apis]
}

module "ops" {
  source       = "./modules/ops"
  project_id   = var.project_id
  region       = var.region
  name         = local.name
  labels       = local.labels
  alert_email  = var.alert_email
  cluster_name = module.gke.cluster_name
  cluster_id   = module.gke.cluster_id

  depends_on = [module.apis, module.gke]
}

module "addons" {
  source = "./modules/addons"

  depends_on = [module.gke]
}
