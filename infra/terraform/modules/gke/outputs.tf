output "cluster_name" {
  value = google_container_cluster.primary.name
}

output "cluster_location" {
  value = google_container_cluster.primary.location
}

output "cluster_id" {
  value = google_container_cluster.primary.id
}

output "endpoint" {
  value     = google_container_cluster.primary.endpoint
  sensitive = true
}

output "ca_certificate" {
  value     = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive = true
}

output "node_service_account_email" {
  value = google_service_account.nodes.email
}

output "workload_app_service_account" {
  value = google_service_account.workload_app.email
}

output "node_pool_id" {
  value = google_container_node_pool.primary.id
}
