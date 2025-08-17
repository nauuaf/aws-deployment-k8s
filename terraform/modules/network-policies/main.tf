# Network Policies for microsegmentation and pod-to-pod communication control

# Default deny-all policy for backend namespace
resource "kubernetes_network_policy" "backend_default_deny" {
  metadata {
    name      = "default-deny-all"
    namespace = "backend"
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]
  }

  depends_on = [var.namespaces]
}

# Allow frontend to access backend services
resource "kubernetes_network_policy" "frontend_to_backend" {
  metadata {
    name      = "frontend-to-backend"
    namespace = "backend"
  }

  spec {
    pod_selector {}
    
    policy_types = ["Ingress"]
    
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "frontend"
          }
        }
      }
      
      ports {
        protocol = "TCP"
        port     = "3000"  # api-service
      }
      
      ports {
        protocol = "TCP"
        port     = "8080"  # auth-service
      }
      
      ports {
        protocol = "TCP"
        port     = "5000"  # image-service
      }
    }
  }

  depends_on = [var.namespaces]
}

# Allow ingress-nginx to access frontend
resource "kubernetes_network_policy" "ingress_to_frontend" {
  metadata {
    name      = "ingress-to-frontend"
    namespace = "frontend"
  }

  spec {
    pod_selector {}
    
    policy_types = ["Ingress"]
    
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "ingress-nginx"
          }
        }
      }
      
      ports {
        protocol = "TCP"
        port     = "3000"
      }
    }
  }

  depends_on = [var.namespaces]
}

# Allow backend services to communicate with each other
resource "kubernetes_network_policy" "backend_internal" {
  metadata {
    name      = "backend-internal"
    namespace = "backend"
  }

  spec {
    pod_selector {}
    
    policy_types = ["Ingress", "Egress"]
    
    # Allow ingress from same namespace
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "backend"
          }
        }
      }
    }
    
    # Allow egress to same namespace
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = "backend"
          }
        }
      }
    }
    
    # Allow egress to DNS
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = "kube-system"
          }
        }
      }
      ports {
        protocol = "UDP"
        port     = "53"
      }
    }
    
    # Allow egress to external services (RDS, S3)
    egress {
      to {
        ip_block {
          cidr = "0.0.0.0/0"
          except = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
        }
      }
      ports {
        protocol = "TCP"
        port     = "5432"  # PostgreSQL
      }
    }
    
    egress {
      to {
        ip_block {
          cidr = "0.0.0.0/0"
          except = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
        }
      }
      ports {
        protocol = "TCP"
        port     = "443"   # HTTPS for S3, AWS APIs
      }
    }
  }

  depends_on = [var.namespaces]
}

# Allow monitoring namespace to scrape metrics from all namespaces
resource "kubernetes_network_policy" "monitoring_scrape" {
  metadata {
    name      = "monitoring-scrape"
    namespace = "backend"
  }

  spec {
    pod_selector {}
    
    policy_types = ["Ingress"]
    
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "monitoring"
          }
        }
      }
      
      # Prometheus metrics ports
      ports {
        protocol = "TCP"
        port     = "8080"  # Metrics endpoints
      }
    }
  }

  depends_on = [var.namespaces]
}

# Similar policy for frontend namespace
resource "kubernetes_network_policy" "monitoring_scrape_frontend" {
  metadata {
    name      = "monitoring-scrape"
    namespace = "frontend"
  }

  spec {
    pod_selector {}
    
    policy_types = ["Ingress"]
    
    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "monitoring"
          }
        }
      }
      
      ports {
        protocol = "TCP"
        port     = "8080"
      }
    }
  }

  depends_on = [var.namespaces]
}

# Default deny-all for frontend namespace
resource "kubernetes_network_policy" "frontend_default_deny" {
  metadata {
    name      = "default-deny-all"
    namespace = "frontend"
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]
  }

  depends_on = [var.namespaces]
}

# Allow frontend to access backend services
resource "kubernetes_network_policy" "frontend_to_backend_egress" {
  metadata {
    name      = "frontend-to-backend-egress"
    namespace = "frontend"
  }

  spec {
    pod_selector {}
    
    policy_types = ["Egress"]
    
    # Allow egress to backend namespace
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = "backend"
          }
        }
      }
      
      ports {
        protocol = "TCP"
        port     = "3000"
      }
      
      ports {
        protocol = "TCP"
        port     = "8080"
      }
      
      ports {
        protocol = "TCP"
        port     = "5000"
      }
    }
    
    # Allow DNS
    egress {
      to {
        namespace_selector {
          match_labels = {
            name = "kube-system"
          }
        }
      }
      ports {
        protocol = "UDP"
        port     = "53"
      }
    }
    
    # Allow HTTPS for external APIs
    egress {
      to {
        ip_block {
          cidr = "0.0.0.0/0"
          except = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
        }
      }
      ports {
        protocol = "TCP"
        port     = "443"
      }
    }
  }

  depends_on = [var.namespaces]
}