output "cert_manager_namespace" {
  description = "Namespace where cert-manager is deployed"
  value       = helm_release.cert_manager.namespace
}

output "cluster_issuers" {
  description = "Available cluster issuers (created via null_resource)"
  value = {
    letsencrypt_staging = "letsencrypt-staging"
    letsencrypt_prod    = "letsencrypt-prod"
    selfsigned          = "selfsigned-issuer"
  }
}

output "frontend_certificate_secret" {
  description = "Secret name containing frontend TLS certificate"
  value       = var.enable_tls ? "frontend-tls-secret" : null
}