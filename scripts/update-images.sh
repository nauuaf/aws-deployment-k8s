#!/bin/bash

# Update Image Tags in Manifests
# Usage: ./scripts/update-images.sh [tag]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# Function to get latest version from ECR
get_latest_version() {
    local project_name="$1"
    local aws_region="$2"
    
    # Get all tags from api-service repository (using as reference)
    local existing_tags=$(aws ecr list-images --repository-name "$project_name/api-service" --region "$aws_region" --query 'imageIds[*].imageTag' --output text 2>/dev/null || echo "")
    
    if [ -z "$existing_tags" ] || [ "$existing_tags" = "None" ]; then
        echo "latest"  # Default to latest if no images exist
        return
    fi
    
    # Check if latest tag exists
    if echo "$existing_tags" | grep -q "latest"; then
        echo "latest"
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
    
    if [ "$max_version" -gt 0 ]; then
        echo "v${max_version}"
    else
        echo "latest"
    fi
}

# Auto-detect latest version if no tag provided
if [ "$#" -eq 0 ]; then
    # Get AWS region first for version detection
    AWS_REGION_TEMP=$(aws configure get region || echo "eu-central-1")
    PROJECT_NAME_TEMP="sre-task"
    
    if [ -f "$PROJECT_ROOT/terraform/environments/poc/terraform.tfstate" ]; then
        cd "$PROJECT_ROOT/terraform/environments/poc"
        PROJECT_NAME_TEMP=$(terraform output -raw project_name 2>/dev/null || echo "sre-task")
        cd "$PROJECT_ROOT"
    fi
    
    TAG=$(get_latest_version "$PROJECT_NAME_TEMP" "$AWS_REGION_TEMP")
else
    TAG="$1"
fi

# Get AWS region and project name
if [ -f "$PROJECT_ROOT/terraform/environments/poc/terraform.tfstate" ]; then
    cd "$PROJECT_ROOT/terraform/environments/poc"
    AWS_REGION=$(terraform output -raw cluster_region 2>/dev/null || aws configure get region || echo "eu-central-1")
    PROJECT_NAME=$(terraform output -raw project_name 2>/dev/null || echo "sre-task")
    cd "$PROJECT_ROOT"
else
    AWS_REGION=$(aws configure get region || echo "eu-central-1")
    PROJECT_NAME="sre-task"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[UPDATE]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get AWS Account ID
log "Getting AWS Account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ $? -ne 0 ]; then
    log_error "Failed to get AWS Account ID. Please ensure AWS CLI is configured."
    exit 1
fi

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
log "Using values:"
log "  ECR Registry: $ECR_REGISTRY"
log "  Project Name: $PROJECT_NAME"
log "  Updating to tag: $TAG"

# Services to update
SERVICES=("api-service" "auth-service" "image-service" "frontend")

# Update image tags in deployment manifests
for service in "${SERVICES[@]}"; do
    manifest_file="$PROJECT_ROOT/manifests/$service/deployment.yaml"
    
    if [ ! -f "$manifest_file" ]; then
        log_error "Manifest file not found: $manifest_file"
        continue
    fi
    
    log "Updating $service manifest..."
    
    # Use sed to replace image tag
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|image: .*/$service:.*|image: $ECR_REGISTRY/$PROJECT_NAME/$service:$TAG|g" "$manifest_file"
    else
        # Linux
        sed -i "s|image: .*/$service:.*|image: $ECR_REGISTRY/$PROJECT_NAME/$service:$TAG|g" "$manifest_file"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Updated $service image tag to $TAG"
    else
        log_error "Failed to update $service manifest"
        exit 1
    fi
done

log_success "All image tags updated to: $TAG"
log "Updated manifests:"
for service in "${SERVICES[@]}"; do
    echo "  - manifests/$service/deployment.yaml"
done

log ""
log "Next steps:"
log "1. Review changes: git diff"
log "2. Deploy applications: ./scripts/deploy.sh staging"