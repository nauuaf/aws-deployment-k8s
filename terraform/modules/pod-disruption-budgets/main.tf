# Pod Disruption Budgets to ensure high availability during maintenance

# PDB for API Service
resource "kubernetes_pod_disruption_budget_v1" "api_service" {
  metadata {
    name      = "api-service-pdb"
    namespace = "backend"
  }

  spec {
    min_available = "50%"
    
    selector {
      match_labels = {
        app = "api-service"
      }
    }
  }

  depends_on = [var.namespaces]
}

# PDB for Auth Service
resource "kubernetes_pod_disruption_budget_v1" "auth_service" {
  metadata {
    name      = "auth-service-pdb"
    namespace = "backend"
  }

  spec {
    min_available = "50%"
    
    selector {
      match_labels = {
        app = "auth-service"
      }
    }
  }

  depends_on = [var.namespaces]
}

# PDB for Image Service
resource "kubernetes_pod_disruption_budget_v1" "image_service" {
  metadata {
    name      = "image-service-pdb"
    namespace = "backend"
  }

  spec {
    min_available = "50%"
    
    selector {
      match_labels = {
        app = "image-service"
      }
    }
  }

  depends_on = [var.namespaces]
}

# PDB for Frontend
resource "kubernetes_pod_disruption_budget_v1" "frontend" {
  metadata {
    name      = "frontend-pdb"
    namespace = "frontend"
  }

  spec {
    min_available = "50%"
    
    selector {
      match_labels = {
        app = "frontend"
      }
    }
  }

  depends_on = [var.namespaces]
}

# PDB for Redis (single instance, so max_unavailable = 0)
resource "kubernetes_pod_disruption_budget_v1" "redis" {
  metadata {
    name      = "redis-pdb"
    namespace = "backend"
  }

  spec {
    max_unavailable = "0"
    
    selector {
      match_labels = {
        app = "redis"
      }
    }
  }

  depends_on = [var.namespaces]
}

# PDB for Prometheus (monitoring)
resource "kubernetes_pod_disruption_budget_v1" "prometheus" {
  metadata {
    name      = "prometheus-pdb"
    namespace = "monitoring"
  }

  spec {
    max_unavailable = "0"  # Single instance
    
    selector {
      match_labels = {
        app = "prometheus"
      }
    }
  }

  depends_on = [var.namespaces]
}

# PDB for Grafana (monitoring)
resource "kubernetes_pod_disruption_budget_v1" "grafana" {
  metadata {
    name      = "grafana-pdb"
    namespace = "monitoring"
  }

  spec {
    max_unavailable = "0"  # Single instance
    
    selector {
      match_labels = {
        app = "grafana"
      }
    }
  }

  depends_on = [var.namespaces]
}