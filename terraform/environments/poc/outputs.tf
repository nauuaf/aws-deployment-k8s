# Essential outputs for SRE Task deployment

# EKS Cluster Info
output "cluster_name" {
  description = "EKS cluster name"
  value       = local.name_prefix
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = try(module.eks.cluster_endpoint, "")
  sensitive   = true
}

output "cluster_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "project_name" {
  description = "Project name used for resource naming"
  value       = var.project_name
}

# Database Connection
output "database_endpoint" {
  description = "RDS endpoint"
  value       = try(module.rds.db_endpoint, "")
  sensitive   = true
}

# Storage
output "s3_bucket_name" {
  description = "S3 bucket for image storage"
  value       = try(module.s3.bucket_id, "")
}

# Container Registry
output "ecr_repositories" {
  description = "ECR repository URLs"
  value = {
    for k, v in aws_ecr_repository.repositories : k => v.repository_url
  }
}

# Security & Networking
output "network_policies_status" {
  description = "Network policies deployment status"
  value       = try("Applied: ${length(module.network_policies.network_policies_applied.backend_policies)} backend, ${length(module.network_policies.network_policies_applied.frontend_policies)} frontend policies", "Not yet applied")
}

output "tls_certificate_issuer" {
  description = "Active TLS certificate issuer"
  value       = var.use_letsencrypt ? "letsencrypt-staging" : "selfsigned-issuer"
}

# Access Information
output "access_info" {
  description = "How to access the deployed services"
  value = {
    kubectl_config = "aws eks update-kubeconfig --region ${var.aws_region} --name ${local.name_prefix}"
    frontend_url   = "https://sre-task.local (add to /etc/hosts)"
    grafana_url    = "kubectl port-forward -n monitoring svc/grafana 3000:3000"
    prometheus_url = "kubectl port-forward -n monitoring svc/prometheus 9090:9090"
  }
}

# Pod Disruption Budgets
output "high_availability_status" {
  description = "Pod Disruption Budgets applied"
  value       = try("Applied: ${length(module.pod_disruption_budgets.pod_disruption_budgets)} PDBs for HA", "Not yet applied")
}