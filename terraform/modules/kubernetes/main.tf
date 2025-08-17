# Kubernetes Resources Module - Simplified for SRE Task
# Manages namespaces, secrets, and HPA configurations

# Cluster info variables removed - provider now configured in main module

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

# Note: Provider configuration is now handled by the calling module

# Namespaces
resource "kubernetes_namespace" "frontend" {
  metadata {
    name = "frontend"
    labels = {
      name       = "frontend"
      managed-by = "terraform"
    }
  }
}

resource "kubernetes_namespace" "backend" {
  metadata {
    name = "backend"
    labels = {
      name       = "backend"
      managed-by = "terraform"
    }
  }
}

resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
    labels = {
      name       = "monitoring"
      managed-by = "terraform"
    }
  }
}

resource "kubernetes_namespace" "ingress_nginx" {
  metadata {
    name = "ingress-nginx"
    labels = {
      name       = "ingress-nginx"
      managed-by = "terraform"
    }
  }
}

# Database Secret (Backend namespace)
resource "kubernetes_secret" "postgres" {
  metadata {
    name      = "postgres-secret"
    namespace = kubernetes_namespace.backend.metadata[0].name
  }
  
  data = {
    POSTGRES_USER     = "sretask_user"
    POSTGRES_PASSWORD = var.postgres_password
    POSTGRES_DB       = "sretask"
  }
  
  type = "Opaque"
}

# Redis Secret (Backend namespace)
resource "kubernetes_secret" "redis" {
  metadata {
    name      = "redis-secret"
    namespace = kubernetes_namespace.backend.metadata[0].name
  }
  
  data = {
    REDIS_PASSWORD = var.redis_password
  }
  
  type = "Opaque"
}

# JWT Secret (Backend namespace)
resource "kubernetes_secret" "jwt" {
  metadata {
    name      = "jwt-secret"
    namespace = kubernetes_namespace.backend.metadata[0].name
  }
  
  data = {
    JWT_SECRET = var.jwt_secret
  }
  
  type = "Opaque"
}

# HPA for API Service
resource "kubernetes_horizontal_pod_autoscaler_v2" "api_service" {
  metadata {
    name      = "api-service-hpa"
    namespace = kubernetes_namespace.backend.metadata[0].name
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = "api-service"
    }

    min_replicas = 2
    max_replicas = 5

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }

    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 80
        }
      }
    }
  }
}

# HPA for Auth Service
resource "kubernetes_horizontal_pod_autoscaler_v2" "auth_service" {
  metadata {
    name      = "auth-service-hpa"
    namespace = kubernetes_namespace.backend.metadata[0].name
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = "auth-service"
    }

    min_replicas = 1
    max_replicas = 3

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }
  }
}

# HPA for Frontend
resource "kubernetes_horizontal_pod_autoscaler_v2" "frontend" {
  metadata {
    name      = "frontend-hpa"
    namespace = kubernetes_namespace.frontend.metadata[0].name
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = "frontend"
    }

    min_replicas = 2
    max_replicas = 4

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }
  }
}

# ConfigMap for backend services configuration
resource "kubernetes_config_map" "backend_config" {
  metadata {
    name      = "backend-config"
    namespace = kubernetes_namespace.backend.metadata[0].name
  }

  data = {
    NODE_ENV = "production"
    PORT     = "3000"
    LOG_LEVEL = "info"
  }
}

# ConfigMap for frontend configuration
resource "kubernetes_config_map" "frontend_config" {
  metadata {
    name      = "frontend-config"
    namespace = kubernetes_namespace.frontend.metadata[0].name
  }

  data = {
    NEXT_PUBLIC_API_URL = "http://api-service.backend.svc.cluster.local:3000"
    NODE_ENV = "production"
  }
}

# Additional secrets for applications
resource "kubernetes_secret" "s3" {
  metadata {
    name      = "s3-secret"
    namespace = kubernetes_namespace.backend.metadata[0].name
  }
  
  data = {
    S3_BUCKET_NAME = var.s3_bucket_name
    AWS_REGION     = var.aws_region
  }
  
  type = "Opaque"
}

resource "kubernetes_secret" "database_url" {
  metadata {
    name      = "database-secret"
    namespace = kubernetes_namespace.backend.metadata[0].name
  }
  
  data = {
    DATABASE_URL = "postgresql://${var.db_username}:${urlencode(var.postgres_password)}@${var.db_endpoint}/${var.db_name}"
  }
  
  type = "Opaque"
}

# Redis Deployment
resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.backend.metadata[0].name
    labels = {
      app = "redis"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "redis"
      }
    }

    template {
      metadata {
        labels = {
          app = "redis"
        }
      }

      spec {
        security_context {
          run_as_non_root = true
          run_as_user     = 999
          run_as_group    = 999
          fs_group        = 999
        }

        container {
          image = "redis:7-alpine"
          name  = "redis"

          port {
            container_port = 6379
            name          = "redis"
          }

          command = ["redis-server"]
          args    = ["--requirepass", var.redis_password]

          resources {
            limits = {
              cpu    = "100m"
              memory = "128Mi"
            }
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
          }

          liveness_probe {
            exec {
              command = ["redis-cli", "-a", var.redis_password, "ping"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "-a", var.redis_password, "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }

          security_context {
            allow_privilege_escalation = false
            read_only_root_filesystem  = false
            capabilities {
              drop = ["ALL"]
            }
          }
        }
      }
    }
  }
}

# Redis Service
resource "kubernetes_service" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.backend.metadata[0].name
    labels = {
      app = "redis"
    }
  }

  spec {
    selector = {
      app = "redis"
    }

    port {
      port        = 6379
      target_port = 6379
      name        = "redis"
    }

    type = "ClusterIP"
  }
}

# Additional variables needed
variable "s3_bucket_name" {
  description = "S3 bucket name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "db_endpoint" {
  description = "Database endpoint"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_username" {
  description = "Database username"
  type        = string
}

# Outputs
output "namespaces" {
  value = {
    frontend      = kubernetes_namespace.frontend.metadata[0].name
    backend       = kubernetes_namespace.backend.metadata[0].name
    monitoring    = kubernetes_namespace.monitoring.metadata[0].name
    ingress_nginx = kubernetes_namespace.ingress_nginx.metadata[0].name
  }
}