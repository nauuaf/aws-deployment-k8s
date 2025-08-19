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

variable "image_service_role_arn" {
  description = "IAM role ARN for image service"
  type        = string
  default     = ""
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

# Service Account for backend services with IAM role
resource "kubernetes_service_account" "backend" {
  metadata {
    name      = "backend-service-account"
    namespace = kubernetes_namespace.backend.metadata[0].name
    labels = {
      app        = "backend-services"
      component  = "backend"
      environment = "poc"
      managed-by = "gitops"
    }
    annotations = var.image_service_role_arn != "" ? {
      "eks.amazonaws.com/role-arn" = var.image_service_role_arn
    } : {}
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
    DATABASE_URL = "postgresql://${var.db_username}:${urlencode(var.postgres_password)}@${var.db_endpoint}/${var.db_name}?sslmode=require"
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

# Database initialization ConfigMap
resource "kubernetes_config_map" "db_init_scripts" {
  metadata {
    name      = "db-init-scripts"
    namespace = kubernetes_namespace.backend.metadata[0].name
  }

  data = {
    "01-create-tables.sql" = <<-EOT
      -- Database initialization script for SRE Task
      -- Creates the required tables for the API service

      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Users table (compatible with auth service requirements)
      DROP TABLE IF EXISTS refresh_tokens CASCADE;
      DROP TABLE IF EXISTS password_reset_tokens CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      
      CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL DEFAULT '',
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          role VARCHAR(50) DEFAULT 'user',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login_at TIMESTAMP WITH TIME ZONE
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

      -- Insert default admin user for testing
      INSERT INTO users (email, first_name, last_name, role) 
      VALUES ('admin@example.com', 'Admin', 'User', 'admin')
      ON CONFLICT (email) DO NOTHING;

      -- Insert test users
      INSERT INTO users (email, first_name, last_name, role) 
      VALUES 
          ('testuser@example.com', 'Test', 'User', 'user'),
          ('john.doe@example.com', 'John', 'Doe', 'user'),
          ('jane.smith@example.com', 'Jane', 'Smith', 'user')
      ON CONFLICT (email) DO NOTHING;

      -- Function to auto-update updated_at timestamp
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Trigger to automatically update updated_at
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();

      -- Refresh tokens table (required by auth service)
      CREATE TABLE refresh_tokens (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(512) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          is_revoked BOOLEAN DEFAULT false
      );

      -- Password reset tokens table (required by auth service)
      CREATE TABLE password_reset_tokens (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token VARCHAR(512) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          used_at TIMESTAMP WITH TIME ZONE
      );

      -- Create indexes for token tables
      CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
      CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
    EOT
  }
}

# Database initialization Job
resource "kubernetes_job_v1" "db_init" {
  metadata {
    generate_name = "db-init-"  # Use generate_name to allow re-creation
    namespace = kubernetes_namespace.backend.metadata[0].name
    labels = {
      app = "db-init"
      component = "database"
    }
  }
  
  # Important: This tells Terraform to wait for the job to complete
  wait_for_completion = true
  
  # Timeout for job completion (in seconds)
  timeouts {
    create = "10m"
    update = "10m"
  }

  spec {
    template {
      metadata {
        labels = {
          app = "db-init"
          component = "database"
        }
      }
      spec {
        restart_policy = "OnFailure"
        active_deadline_seconds = 600  # 10 minute timeout
        container {
          name  = "db-init"
          image = "postgres:15-alpine"
          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            set -e
            echo "Starting database initialization..."
            export PGPASSWORD="$POSTGRES_PASSWORD"
            
            # Wait for database to be ready (with timeout)
            echo "Waiting for database at $POSTGRES_HOST:$POSTGRES_PORT..."
            for i in {1..30}; do
              if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; then
                echo "Database is ready!"
                break
              fi
              echo "Attempt $i/30: Waiting for PostgreSQL to be ready..."
              sleep 10
            done
            
            # Final check
            if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; then
              echo "ERROR: Database is not ready after 5 minutes. Exiting."
              exit 1
            fi
            
            echo "Database is ready. Running initialization scripts..."
            
            # Run initialization scripts
            for script in /init-scripts/*.sql; do
              echo "Running script: $script"
              if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$script"; then
                echo "Successfully executed $script"
              else
                echo "Failed to execute $script"
                exit 1
              fi
            done
            
            echo "Database initialization completed successfully!"
          EOT
          ]

          env {
            name  = "POSTGRES_HOST"
            value = replace(var.db_endpoint, ":5432", "")
          }
          env {
            name  = "POSTGRES_PORT"
            value = "5432"
          }
          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.postgres.metadata[0].name
                key  = "POSTGRES_USER"
              }
            }
          }
          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.postgres.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }
          env {
            name = "POSTGRES_DB"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.postgres.metadata[0].name
                key  = "POSTGRES_DB"
              }
            }
          }

          volume_mount {
            name       = "init-scripts"
            mount_path = "/init-scripts"
          }

          resources {
            requests = {
              memory = "128Mi"  # Increased for PostgreSQL client
              cpu    = "100m"   # Increased for better performance
            }
            limits = {
              memory = "256Mi"  # Increased for PostgreSQL client
              cpu    = "200m"   # Increased for better performance
            }
          }

          security_context {
            allow_privilege_escalation = false
            read_only_root_filesystem  = false
            run_as_non_root           = true
            run_as_user               = 999
            capabilities {
              drop = ["ALL"]
            }
          }
        }

        volume {
          name = "init-scripts"
          config_map {
            name = kubernetes_config_map.db_init_scripts.metadata[0].name
          }
        }
      }
    }
    backoff_limit = 3
    ttl_seconds_after_finished = 120  # Clean up job after 2 minutes
    completion_mode = "NonIndexed"
    parallelism = 1
    completions = 1
  }

  depends_on = [
    kubernetes_secret.postgres, 
    kubernetes_config_map.db_init_scripts,
    kubernetes_secret.database_url
  ]
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
  
  validation {
    condition = can(regex("^[a-zA-Z0-9.-]+$", var.db_endpoint))
    error_message = "Database endpoint must be a valid hostname."
  }
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