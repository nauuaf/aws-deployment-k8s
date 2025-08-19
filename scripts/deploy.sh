#!/bin/bash

# Deploy Applications to Kubernetes
# Usage: ./scripts/deploy.sh [tag]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

dlog() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

dlog_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

dlog_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

dlog_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="poc"
# Function to get next version number for deployment
get_next_version() {
    local project_name="$1"
    local aws_region="$2"
    
    # Get all tags from api-service repository (using as reference)
    local existing_tags=$(aws ecr list-images --repository-name "$project_name/api-service" --region "$aws_region" --query 'imageIds[*].imageTag' --output text 2>/dev/null || echo "")
    
    if [ -z "$existing_tags" ] || [ "$existing_tags" = "None" ]; then
        echo "v1"  # Start with v1 if no images exist
        return
    fi
    
    # Extract version numbers from tags like v1, v2, v3, etc.
    local max_version=0
    for tag in $existing_tags; do
        if [[ "$tag" =~ ^v([0-9]+)$ ]]; then
            local version_num="${BASH_REMATCH[1]}"
            if [ "$version_num" -gt "$max_version" ]; then
                max_version="$version_num"
            fi
        fi
    done
    
    # Increment by 1 for next deployment
    local next_version=$((max_version + 1))
    echo "v${next_version}"
}

# Auto-detect version if no tag provided
if [ "$#" -eq 0 ]; then
    dlog "Auto-detecting next version for new deployment..."
    
    # Get project details for version detection
    PROJECT_NAME="sre-task"
    AWS_REGION_FOR_VERSION="$(aws configure get region || echo eu-central-1)"
    
    if [ -f "$PROJECT_ROOT/terraform/environments/poc/terraform.tfstate" ]; then
        cd "$PROJECT_ROOT/terraform/environments/poc"
        PROJECT_NAME=$(terraform output -raw project_name 2>/dev/null || echo "sre-task")
        cd "$PROJECT_ROOT"
    fi
    
    TAG=$(get_next_version "$PROJECT_NAME" "$AWS_REGION_FOR_VERSION")
    dlog "Auto-detected next version: $TAG"
else
    TAG="$1"
fi

dlog "Deploying to poc environment"
dlog "Using tag: $TAG"

# Update image tags first
if [ "$TAG" != "latest" ]; then
    dlog "Updating image tags to: $TAG"
    "$SCRIPT_DIR/update-images.sh" "$TAG"
fi

# Update manifests with current AWS account and region
dlog "Updating manifests with dynamic values..."
"$SCRIPT_DIR/update-manifests.sh"

# Get project name for ECR check
PROJECT_NAME="sre-task"
if [ -f "$PROJECT_ROOT/terraform/environments/poc/terraform.tfstate" ]; then
    cd "$PROJECT_ROOT/terraform/environments/poc"
    PROJECT_NAME=$(terraform output -raw project_name 2>/dev/null || echo "sre-task")
    cd "$PROJECT_ROOT"
fi

# Check if kubectl is available and connected
dlog "Checking Kubernetes connection..."
if ! kubectl cluster-info >/dev/null 2>&1; then
    dlog_error "Unable to connect to Kubernetes cluster. Please check your kubeconfig."
    exit 1
fi

# Get cluster name
CLUSTER_NAME=$(kubectl config current-context 2>/dev/null || echo "unknown")
dlog "Connected to cluster: $CLUSTER_NAME"

# Check if namespaces exist
dlog "Checking namespaces..."
REQUIRED_NAMESPACES=("frontend" "backend" "monitoring")

for namespace in "${REQUIRED_NAMESPACES[@]}"; do
    if ! kubectl get namespace "$namespace" >/dev/null 2>&1; then
        dlog_error "Namespace '$namespace' does not exist. Please run terraform apply first."
        exit 1
    fi
done

dlog_success "All required namespaces found"

# Check if images exist in ECR before deployment
dlog "Checking if images exist in ECR for tag: $TAG..."
AWS_REGION_FOR_ECR="$(aws configure get region || echo eu-central-1)"

# Check if images exist for all required services
SERVICES_TO_CHECK=("api-service" "auth-service" "image-service" "frontend")
MISSING_SERVICES=()
EXISTING_SERVICES=()

for service in "${SERVICES_TO_CHECK[@]}"; do
    IMAGE_EXISTS=$(aws ecr describe-images --repository-name "$PROJECT_NAME/$service" --region "$AWS_REGION_FOR_ECR" --image-ids imageTag="$TAG" --query 'imageDetails[0].imageDigest' --output text 2>/dev/null || echo "None")
    
    if [ "$IMAGE_EXISTS" = "None" ] || [ "$IMAGE_EXISTS" = "" ]; then
        MISSING_SERVICES+=("$service")
    else
        EXISTING_SERVICES+=("$service")
    fi
done

if [ ${#MISSING_SERVICES[@]} -gt 0 ]; then
    dlog "Missing images for tag '$TAG': ${MISSING_SERVICES[*]}"
    dlog "Building and pushing new images for deployment..."
    "$SCRIPT_DIR/build-images.sh" "$TAG"
    
    # Re-check after build
    STILL_MISSING=()
    for service in "${MISSING_SERVICES[@]}"; do
        IMAGE_EXISTS=$(aws ecr describe-images --repository-name "$PROJECT_NAME/$service" --region "$AWS_REGION_FOR_ECR" --image-ids imageTag="$TAG" --query 'imageDetails[0].imageDigest' --output text 2>/dev/null || echo "None")
        if [ "$IMAGE_EXISTS" = "None" ] || [ "$IMAGE_EXISTS" = "" ]; then
            STILL_MISSING+=("$service")
        fi
    done
    
    if [ ${#STILL_MISSING[@]} -gt 0 ]; then
        dlog_error "Failed to build images for: ${STILL_MISSING[*]}"
        dlog_error "Cannot proceed with deployment"
        exit 1
    else
        dlog_success "All images now available for tag '$TAG'"
    fi
else
    dlog_success "All images with tag '$TAG' found in ECR: ${EXISTING_SERVICES[*]}"
fi


# Define services in dependency order (backend first, then frontend)
BACKEND_SERVICES=("auth-service" "api-service" "image-service")
FRONTEND_SERVICES=("frontend")
ALL_SERVICES=("${BACKEND_SERVICES[@]}" "${FRONTEND_SERVICES[@]}")

# Deploy all Kubernetes resources using overlay
dlog "Cleaning up old replica sets to prevent quota issues..."
# Clean up old replica sets with 0 replicas to prevent quota exhaustion
for ns in backend frontend; do
    old_rs=$(kubectl get rs -n "$ns" --no-headers 2>/dev/null | awk '$2==0 {print $1}')
    if [ ! -z "$old_rs" ]; then
        echo "$old_rs" | xargs kubectl delete rs -n "$ns" 2>/dev/null && \
            dlog_success "Cleaned up old replica sets in $ns namespace"
    fi
done

dlog "Deploying all Kubernetes resources using kustomize overlay..."

overlay_dir="$PROJECT_ROOT/overlays/poc"

if [ ! -d "$overlay_dir" ]; then
    dlog_error "Overlay directory not found: $overlay_dir"
    dlog "Falling back to individual resource deployment..."
    
    # Deploy individual resources
    dlog "Deploying HPA resources..."
    kubectl apply -k "$PROJECT_ROOT/manifests/hpa/" || dlog_warning "HPA deployment failed"
    
    dlog "Deploying Resource Quotas..."
    kubectl apply -k "$PROJECT_ROOT/manifests/resource-quotas/" || dlog_warning "Resource Quotas deployment failed"
    
    dlog "Deploying RBAC resources..."
    kubectl apply -k "$PROJECT_ROOT/manifests/rbac/" || dlog_warning "RBAC deployment failed"
    
    for service in "${ALL_SERVICES[@]}"; do
        dlog "Deploying $service..."
        
        manifest_dir="$PROJECT_ROOT/manifests/$service"
        
        if [ ! -d "$manifest_dir" ]; then
            dlog_error "Manifest directory not found: $manifest_dir"
            continue
        fi
        
        # Apply manifests using kustomize (built into kubectl)
        if ! kubectl apply -k "$manifest_dir/"; then
            dlog_error "Failed to deploy $service"
            exit 1
        fi
        
        dlog_success "Applied manifests for $service"
    done
else
    # Deploy using overlay (includes all resources)
    if ! kubectl apply -k "$overlay_dir/"; then
        dlog_error "Failed to deploy using overlay"
        exit 1
    fi
    
    dlog_success "Applied all Kubernetes resources using poc overlay"
fi

# Check if secrets exist first
dlog "Checking required secrets..."
REQUIRED_SECRETS=("database-secret" "jwt-secret" "s3-secret")
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! kubectl get secret "$secret" -n backend >/dev/null 2>&1; then
        dlog_error "Required secret '$secret' not found in backend namespace"
        dlog_error "Please run terraform apply first to create secrets"
        exit 1
    fi
done
dlog_success "All required secrets found"

# Initialize database if needed
dlog "Checking database initialization..."
DB_INIT_JOB_NAME="db-init"

# Check if database initialization job already completed successfully
if kubectl get job "$DB_INIT_JOB_NAME" -n backend >/dev/null 2>&1; then
    JOB_STATUS=$(kubectl get job "$DB_INIT_JOB_NAME" -n backend -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' 2>/dev/null || echo "False")
    
    if [ "$JOB_STATUS" = "True" ]; then
        dlog_success "Database initialization already completed"
    else
        dlog "Previous database initialization job found but not completed. Cleaning up..."
        kubectl delete job "$DB_INIT_JOB_NAME" -n backend --ignore-not-found=true
        dlog "Running database initialization..."
        
        # Apply database initialization job
        kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: db-init-scripts
  namespace: backend
data:
  01-create-tables.sql: |
    -- Database initialization script for SRE Task
    -- Creates the required tables for the API service

    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    \$\$ language 'plpgsql';

    -- Trigger to automatically update updated_at
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
---
apiVersion: batch/v1
kind: Job
metadata:
  name: db-init
  namespace: backend
  labels:
    app: db-init
    component: database
spec:
  template:
    metadata:
      labels:
        app: db-init
        component: database
    spec:
      restartPolicy: OnFailure
      containers:
      - name: db-init
        image: postgres:15-alpine
        command:
        - /bin/sh
        - -c
        - |
          echo "Starting database initialization..."
          export PGPASSWORD="\$POSTGRES_PASSWORD"
          
          # Wait for database to be ready
          until pg_isready -h "\$POSTGRES_HOST" -p "\$POSTGRES_PORT" -U "\$POSTGRES_USER"; do
            echo "Waiting for PostgreSQL to be ready..."
            sleep 2
          done
          
          echo "Database is ready. Running initialization scripts..."
          
          # Run initialization scripts
          for script in /init-scripts/*.sql; do
            echo "Running script: \$script"
            psql -h "\$POSTGRES_HOST" -p "\$POSTGRES_PORT" -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -f "\$script"
            if [ \$? -eq 0 ]; then
              echo "Successfully executed \$script"
            else
              echo "Failed to execute \$script"
              exit 1
            fi
          done
          
          echo "Database initialization completed successfully!"
        env:
        - name: POSTGRES_HOST
          value: "\$(terraform output -raw rds_endpoint 2>/dev/null || echo 'sre-task-poc-db.c5y84uk6mycf.eu-central-1.rds.amazonaws.com')"
        - name: POSTGRES_PORT
          value: "5432"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_PASSWORD
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_DB
        volumeMounts:
        - name: init-scripts
          mountPath: /init-scripts
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false
          runAsNonRoot: true
          runAsUser: 999
          capabilities:
            drop:
            - ALL
      volumes:
      - name: init-scripts
        configMap:
          name: db-init-scripts
  backoffLimit: 3
EOF
        
        # Wait for database initialization to complete
        dlog "Waiting for database initialization to complete..."
        kubectl wait --for=condition=complete job/"$DB_INIT_JOB_NAME" -n backend --timeout=300s
        
        if [ $? -eq 0 ]; then
            dlog_success "Database initialization completed successfully"
        else
            dlog_error "Database initialization failed"
            kubectl logs job/"$DB_INIT_JOB_NAME" -n backend
            exit 1
        fi
    fi
else
    dlog "Running database initialization..."
    
    # Apply database initialization job
    kubectl apply -f "$PROJECT_ROOT/manifests/database/db-init-job.yaml" 2>/dev/null || {
        dlog "Database initialization manifest not found, creating inline..."
        
        # Apply database initialization job inline
        kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: db-init-scripts
  namespace: backend
data:
  01-create-tables.sql: |
    -- Database initialization script for SRE Task
    -- Creates the required tables for the API service

    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    \$\$ language 'plpgsql';

    -- Trigger to automatically update updated_at
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
---
apiVersion: batch/v1
kind: Job
metadata:
  name: db-init
  namespace: backend
  labels:
    app: db-init
    component: database
spec:
  template:
    metadata:
      labels:
        app: db-init
        component: database
    spec:
      restartPolicy: OnFailure
      containers:
      - name: db-init
        image: postgres:15-alpine
        command:
        - /bin/sh
        - -c
        - |
          echo "Starting database initialization..."
          export PGPASSWORD="\$POSTGRES_PASSWORD"
          
          # Wait for database to be ready
          until pg_isready -h "\$POSTGRES_HOST" -p "\$POSTGRES_PORT" -U "\$POSTGRES_USER"; do
            echo "Waiting for PostgreSQL to be ready..."
            sleep 2
          done
          
          echo "Database is ready. Running initialization scripts..."
          
          # Run initialization scripts
          for script in /init-scripts/*.sql; do
            echo "Running script: \$script"
            psql -h "\$POSTGRES_HOST" -p "\$POSTGRES_PORT" -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -f "\$script"
            if [ \$? -eq 0 ]; then
              echo "Successfully executed \$script"
            else
              echo "Failed to execute \$script"
              exit 1
            fi
          done
          
          echo "Database initialization completed successfully!"
        env:
        - name: POSTGRES_HOST
          value: "sre-task-poc-db.c5y84uk6mycf.eu-central-1.rds.amazonaws.com"
        - name: POSTGRES_PORT
          value: "5432"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_PASSWORD
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_DB
        volumeMounts:
        - name: init-scripts
          mountPath: /init-scripts
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false
          runAsNonRoot: true
          runAsUser: 999
          capabilities:
            drop:
            - ALL
      volumes:
      - name: init-scripts
        configMap:
          name: db-init-scripts
  backoffLimit: 3
EOF
    }
    
    # Wait for database initialization to complete
    dlog "Waiting for database initialization to complete..."
    kubectl wait --for=condition=complete job/"$DB_INIT_JOB_NAME" -n backend --timeout=300s
    
    if [ $? -eq 0 ]; then
        dlog_success "Database initialization completed successfully"
    else
        dlog_error "Database initialization failed"
        kubectl logs job/"$DB_INIT_JOB_NAME" -n backend
        exit 1
    fi
fi

# Wait for backend services first (they have dependencies)
dlog "Waiting for backend services to be ready..."
for service in "${BACKEND_SERVICES[@]}"; do
    dlog "Waiting for $service in backend namespace..."
    
    if ! kubectl rollout status deployment/"$service" -n backend --timeout=300s; then
        dlog_error "Backend service $service failed to become ready"
        exit 1
    fi
    
    dlog_success "$service is ready"
done

# Wait a moment for services to register
dlog "Waiting for backend services to stabilize..."
sleep 10

# Wait for frontend services
dlog "Waiting for frontend services to be ready..."
for service in "${FRONTEND_SERVICES[@]}"; do
    dlog "Waiting for $service in frontend namespace..."
    
    if ! kubectl rollout status deployment/"$service" -n frontend --timeout=300s; then
        dlog_error "Frontend service $service failed to become ready"
        exit 1
    fi
    
    dlog_success "$service is ready"
done

# Check if NGINX Ingress Controller is installed before deploying ingress resources
dlog "Checking for NGINX Ingress Controller..."
if ! kubectl get ingressclass nginx >/dev/null 2>&1; then
    dlog_warning "NGINX Ingress Controller not found"
    dlog_warning "Installing NGINX Ingress Controller first..."
    
    if ! "$SCRIPT_DIR/deploy-ingress.sh"; then
        dlog_error "Failed to install NGINX Ingress Controller"
        exit 1
    fi
    
    dlog_success "NGINX Ingress Controller installed"
fi

# Deploy ingress after services are ready
dlog "Deploying ingress resources..."
if ! kubectl apply -k "$PROJECT_ROOT/manifests/ingress/"; then
    dlog_error "Failed to deploy ingress resources"
    exit 1
fi
dlog_success "Ingress resources deployed"

# Show comprehensive deployment status
dlog "Comprehensive Deployment Status:"
echo ""

# Show pods
dlog "Pod Status:"
for service in "${ALL_SERVICES[@]}"; do
    namespace="backend"
    if [ "$service" = "frontend" ]; then
        namespace="frontend"
    fi
    
    echo -e "${BLUE}$service${NC} (namespace: $namespace):"
    kubectl get pods -n "$namespace" -l app="$service" --no-headers | while read line; do
        echo "  $line"
    done
    echo ""
done

# Show services
dlog "Services:"
kubectl get svc -n backend -n frontend

# Show HPA status
dlog "Horizontal Pod Autoscaler Status:"
kubectl get hpa -n backend -n frontend 2>/dev/null || dlog_warning "HPA not available or metrics server not running"

# Show resource quotas
dlog "Resource Quotas:"
kubectl get resourcequota -n backend -n frontend -n monitoring 2>/dev/null || dlog_warning "Resource quotas not found"

# Show ingress
dlog "Ingress Resources:"
kubectl get ingress -n frontend -n backend 2>/dev/null || dlog_warning "No ingress resources found"

# Show pod disruption budgets
dlog "Pod Disruption Budgets:"
kubectl get pdb -A 2>/dev/null || dlog_warning "No pod disruption budgets found"

dlog_success "Deployment completed successfully!"

# Ask if user wants to deploy monitoring
dlog ""
read -p "Deploy monitoring stack? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    dlog "Deploying monitoring stack..."
    "$SCRIPT_DIR/deploy-monitoring.sh"
else
    dlog "Skipping monitoring deployment. Run './scripts/deploy-monitoring.sh' to deploy later."
fi

dlog ""
dlog "Useful commands:"
dlog "  🔍 Check all pods: kubectl get pods -A"
dlog "  📊 Check HPA status: kubectl get hpa -A"
dlog "  🏷️  Check resource quotas: kubectl get resourcequota -A"
dlog "  🔐 Check secrets: kubectl get secrets -n backend"
dlog "  📝 Check logs: kubectl logs -f -n backend deployment/api-service"
dlog "  🌐 Port forward frontend: kubectl port-forward -n frontend service/frontend 8080:3000"
dlog "  📈 Port forward Grafana: kubectl port-forward -n monitoring service/kube-prometheus-stack-grafana 3000:80"
dlog "  📊 Port forward Prometheus: kubectl port-forward -n monitoring service/kube-prometheus-stack-prometheus 9090:9090"
dlog "  🔧 Get ingress URL: kubectl get ingress -n frontend"
dlog "  💥 Run chaos tests: ./scripts/chaos-engineering.sh [scenario]"
dlog "  ✅ Verify deployment: ./scripts/verify-deployment.sh"
dlog "  📊 Deploy monitoring: ./scripts/deploy-monitoring.sh"
dlog ""
dlog "Next steps:"
dlog "  1. Test the frontend: kubectl port-forward -n frontend service/frontend 8080:3000"
dlog "  2. Access via http://localhost:8080"
dlog "  3. Try the failure simulation features in the 'محاكاة الأعطال' tab"
dlog "  4. Monitor with Grafana: kubectl port-forward -n monitoring service/kube-prometheus-stack-grafana 3000:80"