output "network_name" {
  value = google_compute_network.vpc.name
}

output "network_id" {
  value = google_compute_network.vpc.id
}

output "subnet_name" {
  value = google_compute_subnetwork.private.name
}

output "pods_range_name" {
  value = "${var.name}-pods"
}

output "services_range_name" {
  value = "${var.name}-services"
}

output "nat_name" {
  value = google_compute_router_nat.nat.name
}
