output "service_url" {
  description = "Cloud Run service URL."
  value       = google_cloud_run_v2_service.gateway.uri
}

output "oauth_redirect_uri" {
  description = "Register this exact URI on the Google OAuth client, and ensure gateway.yaml public_url matches the host."
  value       = "${google_cloud_run_v2_service.gateway.uri}/oauth/callback"
}

output "service_account_email" {
  description = "Gateway runtime service account."
  value       = google_service_account.gateway.email
}

output "image" {
  description = "Image the service runs (build/push this separately — see README)."
  value       = local.image
}

output "db_connection_name" {
  description = "Cloud SQL instance connection name (project:region:instance)."
  value       = google_sql_database_instance.db.connection_name
}

output "db_private_ip" {
  description = "Cloud SQL private IP."
  value       = google_sql_database_instance.db.private_ip_address
}

output "public_invoker_granted" {
  description = "Whether the allUsers run.invoker binding was applied (false when invoker_iam_disabled handles public access instead, or on Domain-Restricted-Sharing orgs)."
  value       = length(google_cloud_run_v2_service_iam_member.public) > 0
}
