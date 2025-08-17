output "pod_disruption_budgets" {
  description = "Created Pod Disruption Budgets"
  value = {
    api_service   = kubernetes_pod_disruption_budget_v1.api_service.metadata[0].name
    auth_service  = kubernetes_pod_disruption_budget_v1.auth_service.metadata[0].name
    image_service = kubernetes_pod_disruption_budget_v1.image_service.metadata[0].name
    frontend      = kubernetes_pod_disruption_budget_v1.frontend.metadata[0].name
    redis         = kubernetes_pod_disruption_budget_v1.redis.metadata[0].name
    prometheus    = kubernetes_pod_disruption_budget_v1.prometheus.metadata[0].name
    grafana       = kubernetes_pod_disruption_budget_v1.grafana.metadata[0].name
  }
}