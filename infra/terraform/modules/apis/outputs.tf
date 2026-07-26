output "enabled" {
  description = "Dependency handle — APIs are ready"
  value       = true
  depends_on  = [google_project_service.apis]
}
