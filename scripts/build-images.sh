#!/bin/bash

# Build and push Docker images to ECR
# Usage: ./scripts/build-images.sh [tag]
# 
# If no tag is provided, automatically detects the highest version in ECR
# and increments by 1 (e.g., if v9 exists, builds v10)
# If no versions exist, starts with v1

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Function to get next version number
get_next_version() {
    local project_name="$1"
    local aws_region="$2"
    local aws_account_id="$3"
    
    # Get all tags from api-service repository (using as reference)
    local existing_tags=$(aws ecr list-images --repository-name "$project_name/api-service" --region "$aws_region" --query 'imageIds[*].imageTag' --output text 2>/dev/null || echo "")
    
    if [ -z "$existing_tags" ] || [ "$existing_tags" = "None" ]; then
        echo "v1"
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
    
    # Increment by 1
    local next_version=$((max_version + 1))
    echo "v${next_version}"
}

# Auto-detect next version if no tag provided
if [ "$#" -eq 0 ]; then
    log() { echo -e "\033[0;34m[BUILD]\033[0m $1"; }
    log "Auto-detecting next version..."
    
    # Get AWS credentials first for version detection
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
    AWS_REGION=$(aws configure get region || echo "eu-central-1")
    PROJECT_NAME="sre-task"
    
    if [ -f "$PROJECT_ROOT/terraform/environments/poc/terraform.tfstate" ]; then
        cd "$PROJECT_ROOT/terraform/environments/poc"
        PROJECT_NAME=$(terraform output -raw project_name 2>/dev/null || echo "sre-task")
        cd "$PROJECT_ROOT"
    fi
    
    TAG=$(get_next_version "$PROJECT_NAME" "$AWS_REGION" "$AWS_ACCOUNT_ID")
    log "Auto-detected next version: $TAG"
else
    TAG="$1"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[BUILD]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log "Building and pushing Docker images with tag: $TAG"

# Get AWS Account ID and Region
log "Getting AWS credentials..."
if ! AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null); then
    log_error "Failed to get AWS Account ID. Make sure AWS CLI is configured."
    exit 1
fi

AWS_REGION=$(aws configure get region)
if [ -z "$AWS_REGION" ]; then
    log_warning "No region configured in AWS CLI. Using default: eu-central-1"
    AWS_REGION="eu-central-1"
fi

# Get project name from Terraform or use default
PROJECT_NAME="sre-task"
if [ -f "$PROJECT_ROOT/terraform/environments/poc/terraform.tfstate" ]; then
    cd "$PROJECT_ROOT/terraform/environments/poc"
    PROJECT_NAME=$(terraform output -raw project_name 2>/dev/null || echo "sre-task")
    cd "$PROJECT_ROOT"
fi

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

log "Using values:"
log "  AWS Account ID: $AWS_ACCOUNT_ID"
log "  AWS Region: $AWS_REGION"
log "  Project Name: $PROJECT_NAME"
log "  ECR Registry: $ECR_REGISTRY"

# Login to ECR
log "Logging into ECR..."
if ! aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"; then
    log_error "Failed to login to ECR"
    exit 1
fi

# Services to build
SERVICES=("api-service" "auth-service" "image-service" "frontend")

# Check if service directories exist
for service in "${SERVICES[@]}"; do
    service_dir="$PROJECT_ROOT/services/$service"
    if [ ! -d "$service_dir" ]; then
        log_error "Service directory not found: $service_dir"
        log_error "Please ensure all service source code is available"
        exit 1
    fi
done

# Function to build a single service
build_service() {
    local service="$1"
    local service_dir="$PROJECT_ROOT/services/$service"
    local image_name="${ECR_REGISTRY}/${PROJECT_NAME}/${service}"
    local log_file="$PROJECT_ROOT/.build-$service.log"
    
    # Redirect output to log file
    exec > "$log_file" 2>&1
    
    echo "[BUILD-$service] Starting build for $service..."
    
    # Check if Dockerfile exists
    if [ ! -f "$service_dir/Dockerfile" ]; then
        echo "[BUILD-$service] ERROR: Dockerfile not found in $service_dir"
        echo "FAILED" > "$PROJECT_ROOT/.build-$service.status"
        return 1
    fi
    
    # For Node.js services, ensure package-lock.json exists
    if [ "$service" = "api-service" ] || [ "$service" = "frontend" ]; then
        if [ ! -f "$service_dir/package-lock.json" ]; then
            echo "[BUILD-$service] WARNING: package-lock.json not found for $service, generating it..."
            (cd "$service_dir" && npm install)
        fi
    fi
    
    # Build image with correct platform for EKS (x86_64) and push directly
    echo "[BUILD-$service] Building and pushing $service to ECR..."
    if ! docker buildx build --no-cache --platform linux/amd64 -t "$image_name:$TAG" --push "$service_dir"; then
        echo "[BUILD-$service] ERROR: Failed to build and push $service"
        echo "FAILED" > "$PROJECT_ROOT/.build-$service.status"
        return 1
    fi
    
    # Also tag and push as latest if not already latest
    if [ "$TAG" != "latest" ]; then
        if ! docker buildx build --platform linux/amd64 -t "$image_name:latest" --push "$service_dir"; then
            echo "[BUILD-$service] WARNING: Failed to push latest tag for $service, but $TAG was successful"
        fi
    fi
    
    echo "[BUILD-$service] SUCCESS: Built and pushed $service:$TAG"
    echo "SUCCESS" > "$PROJECT_ROOT/.build-$service.status"
    return 0
}

# Build services in parallel (2 at a time for low risk)
FAILED_SERVICES=()
SUCCESSFUL_SERVICES=()
ACTIVE_BUILDS=()
MAX_CONCURRENT=2

log "Building services in parallel (max $MAX_CONCURRENT concurrent builds)..."

# Clean up any existing status files
for service in "${SERVICES[@]}"; do
    rm -f "$PROJECT_ROOT/.build-$service.status" "$PROJECT_ROOT/.build-$service.log"
done

# Function to start a build
start_build() {
    local service="$1"
    log "Starting build for $service..."
    build_service "$service" &
    local pid=$!
    ACTIVE_BUILDS+=("$pid:$service")
}

# Function to check completed builds
check_builds() {
    local new_active=()
    for build in "${ACTIVE_BUILDS[@]}"; do
        local pid="${build%:*}"
        local service="${build#*:}"
        
        if ! kill -0 "$pid" 2>/dev/null; then
            # Process finished, check status
            wait "$pid"
            local exit_code=$?
            
            if [ -f "$PROJECT_ROOT/.build-$service.status" ]; then
                local status=$(cat "$PROJECT_ROOT/.build-$service.status")
                if [ "$status" = "SUCCESS" ]; then
                    SUCCESSFUL_SERVICES+=("$service")
                    log_success "Build completed: $service"
                else
                    FAILED_SERVICES+=("$service")
                    log_error "Build failed: $service"
                fi
            else
                FAILED_SERVICES+=("$service")
                log_error "Build failed: $service (no status file)"
            fi
            
            # Show build log if there were issues
            if [ -f "$PROJECT_ROOT/.build-$service.log" ] && [ "$status" != "SUCCESS" ]; then
                log_error "Build log for $service:"
                tail -20 "$PROJECT_ROOT/.build-$service.log" | sed 's/^/  /'
            fi
        else
            # Process still running
            new_active+=("$build")
        fi
    done
    ACTIVE_BUILDS=("${new_active[@]}")
}

# Build all services with controlled parallelism
service_index=0
while [ $service_index -lt ${#SERVICES[@]} ] || [ ${#ACTIVE_BUILDS[@]} -gt 0 ]; do
    # Start new builds if we have capacity and services to build
    while [ ${#ACTIVE_BUILDS[@]} -lt $MAX_CONCURRENT ] && [ $service_index -lt ${#SERVICES[@]} ]; do
        start_build "${SERVICES[$service_index]}"
        ((service_index++))
    done
    
    # Check for completed builds
    check_builds
    
    # Brief pause to avoid busy waiting
    sleep 1
done

# Clean up log and status files
for service in "${SERVICES[@]}"; do
    rm -f "$PROJECT_ROOT/.build-$service.status" "$PROJECT_ROOT/.build-$service.log"
done

# Report results
if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    log_error "Failed to build: ${FAILED_SERVICES[*]}"
    if [ ${#SUCCESSFUL_SERVICES[@]} -eq 0 ]; then
        log_error "No services were built successfully"
        exit 1
    else
        log_warning "Some services failed, but ${#SUCCESSFUL_SERVICES[@]} succeeded: ${SUCCESSFUL_SERVICES[*]}"
    fi
fi

# Write build info for deploy script
BUILD_INFO_FILE="$PROJECT_ROOT/.last-build-info"
echo "LAST_BUILD_TAG=$TAG" > "$BUILD_INFO_FILE"
echo "LAST_BUILD_TIME=\"$(date '+%Y-%m-%d %H:%M:%S')\"" >> "$BUILD_INFO_FILE"
echo "SUCCESSFUL_SERVICES=\"${SUCCESSFUL_SERVICES[*]}\"" >> "$BUILD_INFO_FILE"
if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
    echo "FAILED_SERVICES=\"${FAILED_SERVICES[*]}\"" >> "$BUILD_INFO_FILE"
fi

log_success "All images built and pushed successfully!"
log ""
log "Next steps:"
log "  1. Update manifests: ./scripts/update-manifests.sh"
log "  2. Deploy services: ./scripts/deploy.sh"
log ""
log "Image URLs:"
for service in "${SERVICES[@]}"; do
    echo "  $service: ${ECR_REGISTRY}/${PROJECT_NAME}/${service}:${TAG}"
done