output "network_policies_applied" {
  description = "Network policies successfully applied"
  value = {
    backend_policies = [
      kubernetes_network_policy.backend_default_deny.metadata[0].name,
      kubernetes_network_policy.frontend_to_backend.metadata[0].name,
      kubernetes_network_policy.backend_internal.metadata[0].name,
      kubernetes_network_policy.monitoring_scrape.metadata[0].name
    ]
    frontend_policies = [
      kubernetes_network_policy.frontend_default_deny.metadata[0].name,
      kubernetes_network_policy.ingress_to_frontend.metadata[0].name,
      kubernetes_network_policy.frontend_to_backend_egress.metadata[0].name,
      kubernetes_network_policy.monitoring_scrape_frontend.metadata[0].name
    ]
  }
}